# Plan 8b — Health check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An optional team health check before writing: six built-in statements by default, statements managed per team (reorder, archive, restore, custom), a frozen set per retro, answering 1–10 during the `HealthCheck` phase with live progress (counts and who answered, never scores), and the server-side aggregates (average, score, participation, top strength, growth area, alignment, assessment) and team trend that Plan 8d renders in the Results view.

**Architecture:** Three tables (`team_health_statements`, `retro_health_statements`, `health_check_answers`). A team with no row uses the `HealthStatement` enum; the first change materialises the six built-in rows in the same transaction (`ManageTeamHealthStatements`, locked on the team row). When a retro's health check becomes enabled, `FreezeHealthStatements` copies the team's active statements into `retro_health_statements` unless the retro already has answers; everything downstream (answers, progress, aggregates, trend) reads only that frozen set, matching statements by `key`. Board mutations keep the existing pattern (guards, `lockForUpdate` on the retro, `RetroBroadcastEvent` after commit). Aggregates are computed in SQL with `count`, `sum(score)` and `sum(score * score)` so the population standard deviation needs no driver-specific function.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Reverb, Pest, React 19, Inertia v3, `@laravel/echo-react`, `@dnd-kit/core` + `@dnd-kit/sortable` (already installed), Wayfinder, Tailwind 4, lucide.

**Spec:** `docs/superpowers/specs/2026-09-29-retro-flow-extras-design.md` §4 (all), §10.1 (health-check rows), §10.2 (`health.answered`), §10.3 (`healthCheck`), §11 (health check, custom statements, trend), §13 (Health check phase, Team page statements section), §15 (Health check, Team health statements). Cross-plan contract: Plans 8a → 8e; this plan assumes Plan 8a is merged.

## Global Constraints

- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- No new Composer or npm dependency.
- Migrations use the prefix `2026_10_01_1100xx` and only an `up()` method. UUID primary keys and `foreignUuid` like the rest of the schema.
- Redaction invariant (spec §11): a health-check score is only ever sent to its author (`myScore`). Others get, during `HealthCheck`, answer counts and (non-anonymous retros only) the participant ids who answered. No broadcast carries a score. Averages only leave the server through `SummarizeHealthCheck` (rendered by Plan 8d in `Completed`).
- The team trend is never sent to guests (`BuildHealthTrend::forViewer`).
- Team statements are visible to viewers of the team; managing them requires `TeamPolicy::update` (workspace Owner/Admin).
- Every board mutation keeps the controller pattern: guards on the route-bound retro, then again on the `lockForUpdate` retro inside `DB::transaction`, broadcasts via `->sendToOthers()` inside the transaction.
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"); add only missing keys; `tests/Feature/TranslationKeysTest.php` stays green.
- Board API calls go through `retroRequest()`; Wayfinder route functions, no hard-coded URLs. Run `vendor/bin/sail artisan wayfinder:generate --with-form` after route changes.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp fmt <files>`; never `npx prettier` on the repo.
- React style: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `useBoard()` for board state.
- PHP style: constructor promotion, typed everything, array-shape docblocks for presenter return values, early returns, curly braces always, no comments that restate code.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Consumed from Plan 8a

- `App\Enums\RetroPhase::HealthCheck` (`'health_check'`), first case; `RetroPhase::label()` already returns `__('Health check')`.
- `retros.health_check_enabled` (bool, default `false`), cast to boolean on `Retro`; `RetroFactory::withHealthCheck()` state (sets `health_check_enabled = true`).
- `App\Actions\Retros\CreateRetro::handle(Team $team, User $creator, NewRetro $data): Retro` with `NewRetro::$healthCheckEnabled`; `POST teams.retros.store` accepts `health_check_enabled`.
- `RetroSettingsController::update` validates `health_check_enabled` / `icebreaker_enabled` and refuses turning off the current phase.
- `resources/js/components/retro/phase-panel.tsx` (`PhasePanel`, rendered above the columns) switches on the phase with only an `icebreaker` branch; the Health check switch is in neither `settings-dialog.tsx` nor `teams/new-retro-dialog.tsx` (both added by Task 8); the frontend `RetroPhase` type includes `'health_check'` and `Snapshot.retro.healthCheckEnabled` exists.

## Review Focus

1. **Answer for a statement key that is not in the retro's frozen set** (another team's custom statement id, a statement archived before the freeze, a typo) → 404, nothing written. Pinned in Task 4 ("returns 404 for statements outside the retro's set").
2. **Facilitator turns the health check off and on again after people answered, while the team has since changed its statements** → the retro keeps the set its answers refer to; results stay consistent. Pinned in Task 3 ("keeps the frozen set once answered").
3. **A participant clicks two scores quickly for the same statement (two PUTs)** → one row with the last score, count stays 1. Pinned in Task 4 ("changes a score without duplicating the answer").
4. **Only one statement answered, or only one respondent** → that statement's average is reported (no minimum), the score equals it, top strength and growth area are `null`, the other statements report `null` and are excluded. Pinned in Task 5 ("reports every answered statement and excludes the others").
5. **A custom statement longer than 150 characters or an axis label longer than 30** → 422 on the team page form, nothing stored; stored text is rendered as text (React escapes it). Pinned in Task 2 ("validates statement text and axis label lengths").

## File map

| Area | Files |
|---|---|
| Schema + models | migrations `2026_10_01_110000_create_team_health_statements_table`, `2026_10_01_110100_create_retro_health_statements_table`, `2026_10_01_110200_create_health_check_answers_table`; `app/Enums/HealthStatement.php`; `app/Models/{TeamHealthStatement,RetroHealthStatement,HealthCheckAnswer}.php`; `app/Models/{Retro,Team}.php`; factories `{TeamHealthStatement,RetroHealthStatement,HealthCheckAnswer}Factory` |
| Team statements | `app/Actions/HealthCheck/{TeamHealthStatements,ManageTeamHealthStatements,PresentHealthStatement}.php`; `app/Http/Controllers/{TeamHealthStatementsController,TeamHealthStatementOrdersController,TeamHealthStatementArchivalsController}.php`; `routes/web.php`; `app/Http/Controllers/TeamsController.php` |
| Frozen set | `app/Actions/HealthCheck/FreezeHealthStatements.php`; `app/Actions/Retros/CreateRetro.php`; `app/Http/Controllers/Retros/RetroSettingsController.php` |
| Answering + progress | `app/Http/Controllers/Retros/HealthCheckAnswersController.php`; `app/Actions/HealthCheck/{PresentHealthProgress,PresentHealthCheck}.php`; `app/Events/Retros/HealthAnswered.php`; `app/Actions/Retros/BuildBoardSnapshot.php` |
| Aggregates + trend | `app/Actions/HealthCheck/{SummarizeHealthCheck,BuildHealthTrend}.php` |
| Frontend | `resources/js/types/workspaces.ts`, `resources/js/components/teams/health-statements-section.tsx`, `resources/js/pages/teams/show.tsx`; `resources/js/lib/retro/{types,board-reducer}.ts`, `resources/js/hooks/{use-retro-channel,use-retro-board}.ts`, `resources/js/components/retro/{health-check-panel,phase-panel,settings-dialog}.tsx`, `resources/js/components/teams/new-retro-dialog.tsx` |
| Translations | `lang/{en,fr,es,de}.json` |
| Tests | `tests/Feature/Retros/HealthStatementModelsTest.php`, `tests/Feature/Teams/TeamHealthStatementsTest.php`, `tests/Feature/Retros/HealthStatementFreezeTest.php`, `tests/Feature/Retros/HealthCheckTest.php`, `tests/Feature/Retros/HealthCheckSummaryTest.php`, `tests/Feature/Retros/HealthTrendTest.php`, `tests/Feature/Teams/TeamsTest.php` |

## Translations used by this plan

Add every key below that is missing from `lang/en.json` (value = key) and its translation to `lang/fr.json`, `lang/es.json`, `lang/de.json`. Tasks refer back to this table; each task adds the keys it introduces.

| Key (en) | fr | es | de |
|---|---|---|---|
| Interaction with colleagues was productive | Les échanges avec mes collègues ont été productifs | La interacción con mis compañeros fue productiva | Die Zusammenarbeit mit meinen Kollegen war produktiv |
| Tasks assigned to me were clear | Les tâches qui m’ont été confiées étaient claires | Las tareas que me asignaron estaban claras | Die mir zugewiesenen Aufgaben waren klar |
| My manager was understanding and supportive | Mon manager a été compréhensif et m’a soutenu | Mi responsable fue comprensivo y me apoyó | Meine Führungskraft war verständnisvoll und unterstützend |
| The vision and goals are clear to me | La vision et les objectifs sont clairs pour moi | La visión y los objetivos me resultan claros | Vision und Ziele sind mir klar |
| Our processes let me work without blockers | Nos processus me permettent de travailler sans blocage | Nuestros procesos me permiten trabajar sin bloqueos | Unsere Prozesse lassen mich ohne Blocker arbeiten |
| I felt motivated in my work | Je me suis senti motivé dans mon travail | Me sentí motivado en mi trabajo | Ich war bei meiner Arbeit motiviert |
| Interaction | Interactions | Interacción | Zusammenarbeit |
| Clear tasks | Tâches claires | Tareas claras | Klare Aufgaben |
| Manager support | Soutien du manager | Apoyo del responsable | Unterstützung durch Führung |
| Vision | Vision | Visión | Vision |
| Processes | Processus | Procesos | Prozesse |
| Motivation | Motivation | Motivación | Motivation |
| Awful | Horrible | Horrible | Furchtbar |
| Great | Excellent | Genial | Großartig |
| A team needs between 3 and 10 health check statements. | Une équipe a besoin de 3 à 10 affirmations de bilan de santé. | Un equipo necesita entre 3 y 10 afirmaciones del chequeo de salud. | Ein Team braucht zwischen 3 und 10 Aussagen für den Gesundheitscheck. |
| A team can have at most 30 health check statements, archived ones included. | Une équipe peut avoir au plus 30 affirmations de bilan de santé, archivées comprises. | Un equipo puede tener como máximo 30 afirmaciones del chequeo de salud, incluidas las archivadas. | Ein Team kann höchstens 30 Aussagen für den Gesundheitscheck haben, archivierte eingeschlossen. |
| Built-in statements cannot be reworded. | Les affirmations intégrées ne peuvent pas être reformulées. | Las afirmaciones predefinidas no se pueden reformular. | Integrierte Aussagen können nicht umformuliert werden. |
| Send every active health check statement exactly once. | Envoyez chaque affirmation active exactement une fois. | Envía cada afirmación activa exactamente una vez. | Sende jede aktive Aussage genau einmal. |
| Statement added. | Affirmation ajoutée. | Afirmación añadida. | Aussage hinzugefügt. |
| Statement updated. | Affirmation modifiée. | Afirmación actualizada. | Aussage aktualisiert. |
| Statements reordered. | Affirmations réordonnées. | Afirmaciones reordenadas. | Aussagen neu sortiert. |
| Statement archived. | Affirmation archivée. | Afirmación archivada. | Aussage archiviert. |
| Statement restored. | Affirmation restaurée. | Afirmación restaurada. | Aussage wiederhergestellt. |
| Excellent | Excellent | Excelente | Ausgezeichnet |
| Good | Bon | Bien | Gut |
| Needs attention | À surveiller | Requiere atención | Braucht Aufmerksamkeit |
| Critical | Critique | Crítico | Kritisch |
| The team is thriving. Keep doing what works. | L’équipe s’épanouit. Continuez ce qui fonctionne. | El equipo está en plena forma. Sigue con lo que funciona. | Dem Team geht es richtig gut. Behaltet bei, was funktioniert. |
| Most health scores are above average. Keep the momentum going. | La plupart des scores sont au-dessus de la moyenne. Gardez cette dynamique. | La mayoría de las puntuaciones están por encima de la media. Mantén el impulso. | Die meisten Werte liegen über dem Durchschnitt. Bleibt dran. |
| Several areas need attention. Pick one to improve next. | Plusieurs points demandent de l’attention. Choisissez-en un à améliorer. | Varias áreas requieren atención. Elige una para mejorar a continuación. | Mehrere Bereiche brauchen Aufmerksamkeit. Wählt einen aus, den ihr als Nächstes verbessert. |
| The team is struggling. Talk about what would help most. | L’équipe est en difficulté. Parlez de ce qui aiderait le plus. | El equipo lo está pasando mal. Habla de lo que más ayudaría. | Das Team kämpft. Sprecht darüber, was am meisten helfen würde. |
| High team consensus | Fort consensus dans l’équipe | Alto consenso en el equipo | Hoher Konsens im Team |
| Moderate consensus | Consensus modéré | Consenso moderado | Mäßiger Konsens |
| Divided opinions | Avis partagés | Opiniones divididas | Geteilte Meinungen |
| Health check statements | Affirmations du bilan de santé | Afirmaciones del chequeo de salud | Aussagen für den Gesundheitscheck |
| Changes apply to retros that have not collected answers yet. | Les modifications s’appliquent aux rétros qui n’ont pas encore recueilli de réponses. | Los cambios se aplican a las retros que aún no han recogido respuestas. | Änderungen gelten für Retros, die noch keine Antworten gesammelt haben. |
| Statement | Affirmation | Afirmación | Aussage |
| Axis label | Libellé de l’axe | Etiqueta del eje | Achsenbeschriftung |
| Add statement | Ajouter une affirmation | Añadir afirmación | Aussage hinzufügen |
| Edit | Modifier | Editar | Bearbeiten |
| Archive | Archiver | Archivar | Archivieren |
| Restore | Restaurer | Restaurar | Wiederherstellen |
| Archived (:count) | Archivées (:count) | Archivadas (:count) | Archiviert (:count) |
| Built-in | Intégrée | Predefinida | Integriert |
| Drag to reorder | Glisser pour réordonner | Arrastra para reordenar | Zum Sortieren ziehen |
| To pick up a statement, press Space or Enter. Use the arrow keys to move it, Space or Enter to drop it, or Escape to cancel. | Pour saisir une affirmation, appuyez sur Espace ou Entrée. Déplacez-la avec les flèches, déposez-la avec Espace ou Entrée, ou annulez avec Échap. | Para tomar una afirmación, pulsa Espacio o Intro. Muévela con las flechas, suéltala con Espacio o Intro, o cancela con Escape. | Um eine Aussage aufzunehmen, drücke Leertaste oder Enter. Verschiebe sie mit den Pfeiltasten, lege sie mit Leertaste oder Enter ab oder brich mit Escape ab. |
| Picked up :statement. | « :statement » saisie. | «:statement» tomada. | „:statement“ aufgenommen. |
| Moved :statement to position :position. | « :statement » déplacée en position :position. | «:statement» movida a la posición :position. | „:statement“ an Position :position verschoben. |
| Dropped :statement. | « :statement » déposée. | «:statement» soltada. | „:statement“ abgelegt. |
| Reordering cancelled. | Réorganisation annulée. | Reordenación cancelada. | Sortieren abgebrochen. |
| Health check | Bilan de santé | Chequeo de salud | Gesundheitscheck |
| Rate each statement from 1 (Awful) to 10 (Great). Only you see your own scores. | Notez chaque affirmation de 1 (Horrible) à 10 (Excellent). Vous seul voyez vos notes. | Puntúa cada afirmación de 1 (Horrible) a 10 (Genial). Solo tú ves tus puntuaciones. | Bewerte jede Aussage von 1 (Furchtbar) bis 10 (Großartig). Nur du siehst deine Werte. |
| Clear | Effacer | Borrar | Löschen |
| Answered | Répondu | Respondida | Beantwortet |
| :count answered | Réponses : :count | Respuestas: :count | Antworten: :count |
| Score :score | Note :score | Puntuación :score | Wert :score |

---

### Task 1: Statements enum, tables, models and factories

**Files:**
- Create: `app/Enums/HealthStatement.php`
- Create: `database/migrations/2026_10_01_110000_create_team_health_statements_table.php`, `database/migrations/2026_10_01_110100_create_retro_health_statements_table.php`, `database/migrations/2026_10_01_110200_create_health_check_answers_table.php`
- Create: `app/Models/TeamHealthStatement.php`, `app/Models/RetroHealthStatement.php`, `app/Models/HealthCheckAnswer.php`
- Create: `database/factories/TeamHealthStatementFactory.php`, `database/factories/RetroHealthStatementFactory.php`, `database/factories/HealthCheckAnswerFactory.php`
- Modify: `app/Models/Retro.php`, `app/Models/Team.php`
- Modify: `lang/{en,fr,es,de}.json` (the six statements, six labels)
- Test: create `tests/Feature/Retros/HealthStatementModelsTest.php`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `App\Enums\HealthStatement` cases `Interaction='interaction'`, `TaskClarity='task_clarity'`, `ManagerSupport='manager_support'`, `Vision='vision'`, `Processes='processes'`, `Motivation='motivation'`; `text(): string`, `label(): string` (translated).
  - `TeamHealthStatement` (`team_id`, `builtin: ?HealthStatement`, `text: ?string`, `label: ?string`, `position: int`, `archived_at: ?Carbon`), methods `key(): string` (builtin value, else id), `isBuiltin(): bool`, `isArchived(): bool`.
  - `RetroHealthStatement` (`retro_id`, `key: string`, `team_health_statement_id: ?string`, `builtin: ?HealthStatement`, `text`, `label`, `position`).
  - `HealthCheckAnswer` (`retro_id`, `participant_id`, `statement: string`, `score: int`).
  - `Retro::healthStatements(): HasMany` (ordered by position), `Retro::healthCheckAnswers(): HasMany`, `Team::healthStatements(): HasMany` (ordered by position, then created_at).
  - Factories: `TeamHealthStatement::factory()->builtin(HealthStatement)`, `->archived()`; `RetroHealthStatement::factory()->builtin(HealthStatement)` (default Interaction), `->custom()`; `HealthCheckAnswer::factory()`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/HealthStatementModelsTest.php`:

```php
<?php

use App\Enums\HealthStatement;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

it('lists the six built-in statements in their default order with translated texts and labels', function () {
    app()->setLocale('fr');

    expect(array_map(fn (HealthStatement $statement) => $statement->value, HealthStatement::cases()))->toBe([
        'interaction', 'task_clarity', 'manager_support', 'vision', 'processes', 'motivation',
    ])
        ->and(HealthStatement::TaskClarity->text())->toBe('Les tâches qui m’ont été confiées étaient claires')
        ->and(HealthStatement::TaskClarity->label())->toBe('Tâches claires');
});

it('keys built-in team statements by their value and custom ones by their id', function () {
    $builtin = TeamHealthStatement::factory()->builtin(HealthStatement::Vision)->create();
    $custom = TeamHealthStatement::factory()->create(['text' => 'We shipped on time', 'label' => 'Delivery']);

    expect($builtin->key())->toBe('vision')
        ->and($builtin->isBuiltin())->toBeTrue()
        ->and($custom->key())->toBe($custom->id)
        ->and($custom->isBuiltin())->toBeFalse()
        ->and($custom->isArchived())->toBeFalse()
        ->and(TeamHealthStatement::factory()->archived()->create()->isArchived())->toBeTrue();
});

it('orders team and retro statements by position', function () {
    $team = Team::factory()->create();
    TeamHealthStatement::factory()->for($team)->create(['position' => 1, 'label' => 'Second']);
    TeamHealthStatement::factory()->for($team)->create(['position' => 0, 'label' => 'First']);

    $retro = Retro::factory()->create();
    RetroHealthStatement::factory()->for($retro)->builtin(HealthStatement::Vision)->create(['position' => 1]);
    RetroHealthStatement::factory()->for($retro)->builtin(HealthStatement::Motivation)->create(['position' => 0]);

    expect($team->healthStatements()->pluck('label')->all())->toBe(['First', 'Second'])
        ->and($retro->healthStatements()->pluck('key')->all())->toBe(['motivation', 'vision']);
});

it('stores one answer per participant and statement', function () {
    $answer = HealthCheckAnswer::factory()->create(['statement' => 'vision', 'score' => 7]);

    expect($answer->retro->healthCheckAnswers()->sole()->score)->toBe(7);

    HealthCheckAnswer::factory()->create([
        'retro_id' => $answer->retro_id,
        'participant_id' => $answer->participant_id,
        'statement' => 'vision',
    ]);
})->throws(QueryException::class);

it('refuses a built-in team statement that also has a text', function () {
    TeamHealthStatement::factory()->create(['builtin' => HealthStatement::Vision, 'text' => 'Reworded', 'label' => 'Vision']);
})->throws(QueryException::class)->skip(fn () => DB::getDriverName() !== 'pgsql', 'check constraint is PostgreSQL only');

it('removes a retro frozen set and its answers with the retro', function () {
    $retro = Retro::factory()->create();
    RetroHealthStatement::factory()->for($retro)->create();
    HealthCheckAnswer::factory()->create([
        'retro_id' => $retro->id,
        'participant_id' => Participant::factory()->create(['retro_id' => $retro->id])->id,
    ]);

    $retro->delete();

    expect(RetroHealthStatement::count())->toBe(0)->and(HealthCheckAnswer::count())->toBe(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/HealthStatementModelsTest.php`
Expected: FAIL with `Class "App\Enums\HealthStatement" not found`.

- [ ] **Step 3: Create the enum**

`app/Enums/HealthStatement.php`:

```php
<?php

namespace App\Enums;

enum HealthStatement: string
{
    case Interaction = 'interaction';
    case TaskClarity = 'task_clarity';
    case ManagerSupport = 'manager_support';
    case Vision = 'vision';
    case Processes = 'processes';
    case Motivation = 'motivation';

    public function text(): string
    {
        return match ($this) {
            self::Interaction => __('Interaction with colleagues was productive'),
            self::TaskClarity => __('Tasks assigned to me were clear'),
            self::ManagerSupport => __('My manager was understanding and supportive'),
            self::Vision => __('The vision and goals are clear to me'),
            self::Processes => __('Our processes let me work without blockers'),
            self::Motivation => __('I felt motivated in my work'),
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Interaction => __('Interaction'),
            self::TaskClarity => __('Clear tasks'),
            self::ManagerSupport => __('Manager support'),
            self::Vision => __('Vision'),
            self::Processes => __('Processes'),
            self::Motivation => __('Motivation'),
        };
    }
}
```

- [ ] **Step 4: Create the migrations**

`database/migrations/2026_10_01_110000_create_team_health_statements_table.php`:

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
        Schema::create('team_health_statements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('builtin')->nullable();
            $table->string('text', 150)->nullable();
            $table->string('label', 30)->nullable();
            $table->unsignedSmallInteger('position');
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->unique(['team_id', 'builtin']);
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(<<<'SQL'
            alter table team_health_statements add constraint team_health_statements_builtin_or_custom check (
                (builtin is not null and text is null and label is null)
                or (builtin is null and text is not null and label is not null)
            )
            SQL);
    }
};
```

PostgreSQL and SQLite treat `NULL`s as distinct in unique indexes, so `unique(['team_id', 'builtin'])` only constrains built-in rows (spec §3 "where `builtin` is not null").

`database/migrations/2026_10_01_110100_create_retro_health_statements_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retro_health_statements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->string('key', 64);
            $table->foreignUuid('team_health_statement_id')->nullable()->constrained()->nullOnDelete();
            $table->string('builtin')->nullable();
            $table->string('text', 150)->nullable();
            $table->string('label', 30)->nullable();
            $table->unsignedSmallInteger('position');
            $table->timestamps();

            $table->unique(['retro_id', 'key']);
        });
    }
};
```

`database/migrations/2026_10_01_110200_create_health_check_answers_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('health_check_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
            $table->string('statement', 64);
            $table->unsignedTinyInteger('score');
            $table->timestamps();

            $table->unique(['retro_id', 'participant_id', 'statement']);
            $table->index(['retro_id', 'statement']);
        });
    }
};
```

- [ ] **Step 5: Create the models**

`app/Models/TeamHealthStatement.php`:

```php
<?php

namespace App\Models;

use App\Enums\HealthStatement;
use Database\Factories\TeamHealthStatementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string|null $id
 * @property string $team_id
 * @property HealthStatement|null $builtin
 * @property string|null $text
 * @property string|null $label
 * @property int $position
 * @property Carbon|null $archived_at
 * @property Carbon|null $created_at
 */
#[Fillable(['team_id', 'builtin', 'text', 'label', 'position', 'archived_at'])]
class TeamHealthStatement extends Model
{
    /** @use HasFactory<TeamHealthStatementFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function key(): string
    {
        return $this->builtin?->value ?? (string) $this->id;
    }

    public function isBuiltin(): bool
    {
        return $this->builtin !== null;
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    protected function casts(): array
    {
        return [
            'builtin' => HealthStatement::class,
            'position' => 'integer',
            'archived_at' => 'datetime',
        ];
    }
}
```

`id` is nullable in the docblock because `TeamHealthStatements::defaults()` (Task 2) builds unsaved built-in instances for a team with no row.

`app/Models/RetroHealthStatement.php`:

```php
<?php

namespace App\Models;

use App\Enums\HealthStatement;
use Database\Factories\RetroHealthStatementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $key
 * @property string|null $team_health_statement_id
 * @property HealthStatement|null $builtin
 * @property string|null $text
 * @property string|null $label
 * @property int $position
 */
#[Fillable(['retro_id', 'key', 'team_health_statement_id', 'builtin', 'text', 'label', 'position'])]
class RetroHealthStatement extends Model
{
    /** @use HasFactory<RetroHealthStatementFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    protected function casts(): array
    {
        return [
            'builtin' => HealthStatement::class,
            'position' => 'integer',
        ];
    }
}
```

`app/Models/HealthCheckAnswer.php`:

```php
<?php

namespace App\Models;

use Database\Factories\HealthCheckAnswerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $participant_id
 * @property string $statement
 * @property int $score
 * @property-read Retro $retro
 */
#[Fillable(['retro_id', 'participant_id', 'statement', 'score'])]
class HealthCheckAnswer extends Model
{
    /** @use HasFactory<HealthCheckAnswerFactory> */
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
        return [
            'score' => 'integer',
        ];
    }
}
```

Add to `app/Models/Retro.php` (after `actionItems()`):

```php
    /** @return HasMany<RetroHealthStatement, $this> */
    public function healthStatements(): HasMany
    {
        return $this->hasMany(RetroHealthStatement::class)->orderBy('position');
    }

    /** @return HasMany<HealthCheckAnswer, $this> */
    public function healthCheckAnswers(): HasMany
    {
        return $this->hasMany(HealthCheckAnswer::class);
    }
```

Add to `app/Models/Team.php` (after `retros()`):

```php
    /** @return HasMany<TeamHealthStatement, $this> */
    public function healthStatements(): HasMany
    {
        return $this->hasMany(TeamHealthStatement::class)->orderBy('position')->orderBy('created_at');
    }
```

- [ ] **Step 6: Create the factories**

`database/factories/TeamHealthStatementFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\HealthStatement;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamHealthStatement>
 */
class TeamHealthStatementFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'builtin' => null,
            'text' => fake()->sentence(5),
            'label' => fake()->word(),
            'position' => 0,
        ];
    }

    public function builtin(HealthStatement $statement): static
    {
        return $this->state(fn () => ['builtin' => $statement, 'text' => null, 'label' => null]);
    }

    public function archived(): static
    {
        return $this->state(fn () => ['archived_at' => now()]);
    }
}
```

`database/factories/RetroHealthStatementFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\HealthStatement;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<RetroHealthStatement>
 */
class RetroHealthStatementFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'key' => HealthStatement::Interaction->value,
            'builtin' => HealthStatement::Interaction,
            'text' => null,
            'label' => null,
            'position' => 0,
        ];
    }

    public function builtin(HealthStatement $statement): static
    {
        return $this->state(fn () => ['key' => $statement->value, 'builtin' => $statement, 'text' => null, 'label' => null]);
    }

    public function custom(): static
    {
        return $this->state(fn () => [
            'key' => (string) Str::uuid(),
            'builtin' => null,
            'text' => fake()->sentence(5),
            'label' => fake()->word(),
        ]);
    }
}
```

`database/factories/HealthCheckAnswerFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\HealthStatement;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HealthCheckAnswer>
 */
class HealthCheckAnswerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'statement' => HealthStatement::Interaction->value,
            'score' => 5,
        ];
    }
}
```

Factories create through mass assignment, so the three models list their foreign key in `Fillable` (already done in the model code above).

- [ ] **Step 7: Add translations**

Add the rows "Interaction with colleagues was productive" through "Motivation" of the translation table to the four JSON files.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Retros/HealthStatementModelsTest.php tests/Feature/UuidPrimaryKeysTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Enums/HealthStatement.php app/Models database/migrations database/factories lang tests/Feature/Retros/HealthStatementModelsTest.php
git commit -m "feat: add health check statements, frozen sets and answers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 2: Team statements — materialise, add, reword, reorder, archive, restore

**Files:**
- Create: `app/Actions/HealthCheck/TeamHealthStatements.php`, `app/Actions/HealthCheck/ManageTeamHealthStatements.php`, `app/Actions/HealthCheck/PresentHealthStatement.php`
- Create: `app/Http/Controllers/TeamHealthStatementsController.php`, `app/Http/Controllers/TeamHealthStatementOrdersController.php`, `app/Http/Controllers/TeamHealthStatementArchivalsController.php`
- Modify: `routes/web.php`
- Modify: `lang/{en,fr,es,de}.json` (errors and flash messages)
- Test: create `tests/Feature/Teams/TeamHealthStatementsTest.php`

**Interfaces:**
- Consumes: Task 1 models and enum.
- Produces:
  - `TeamHealthStatements::all(Team $team): Collection<int, TeamHealthStatement>` (stored rows, or six unsaved built-ins when the team has none), `::active(Team $team): Collection<int, TeamHealthStatement>` (not archived, in order), `::defaults(): Collection<int, TeamHealthStatement>`.
  - `ManageTeamHealthStatements::add(Team $team, string $text, string $label): TeamHealthStatement`, `::reword(Team $team, string $statement, string $text, string $label): TeamHealthStatement`, `::reorder(Team $team, array<int, string> $ids): void`, `::archive(Team $team, string $statement): void`, `::restore(Team $team, string $statement): void` — `$statement` is a row id or a `HealthStatement` value; each runs in a transaction with the team row locked and materialises the six built-ins first.
  - `PresentHealthStatement::handle(RetroHealthStatement|TeamHealthStatement|HealthStatement $statement): array{key: string, label: string, text: string, isBuiltin: bool}`.
  - Routes `teams.healthStatements.store` (POST `w/{workspace}/teams/{team}/health-statements`), `teams.healthStatements.update` (PATCH `…/health-statements/{statement}`), `teams.healthStatements.order.update` (PUT `…/health-statement-order`), `teams.healthStatements.archival.update` (PUT `…/health-statements/{statement}/archival`, archive), `teams.healthStatements.archival.destroy` (DELETE, restore).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Teams/TeamHealthStatementsTest.php`:

```php
<?php

use App\Enums\HealthStatement;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Models\User;
use App\Models\Workspace;

/**
 * @return array{0: User, 1: Workspace, 2: Team}
 */
function healthStatementTeam(WorkspaceRole $role = WorkspaceRole::Admin): array
{
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, $role)->create();
    $team = Team::factory()->for($workspace)->withMember($user)->create();

    return [$user, $workspace, $team];
}

/**
 * @param  array<string, string>  $parameters
 */
function healthStatementRoute(string $name, Team $team, array $parameters = []): string
{
    return route("teams.healthStatements.{$name}", ['workspace' => $team->workspace, 'team' => $team, ...$parameters]);
}

/**
 * @return array<int, string>
 */
function activeHealthKeys(Team $team): array
{
    return $team->healthStatements()->whereNull('archived_at')->get()->map(fn (TeamHealthStatement $statement) => $statement->key())->all();
}

it('adds a custom statement after materialising the six built-ins', function () {
    [$user, , $team] = healthStatementTeam();

    $this->actingAs($user)
        ->from(route('teams.show', [$team->workspace, $team]))
        ->post(healthStatementRoute('store', $team), ['text' => 'We shipped what we promised', 'label' => 'Delivery'])
        ->assertRedirect(route('teams.show', [$team->workspace, $team]))
        ->assertSessionHasNoErrors();

    $statements = $team->healthStatements()->get();

    expect($statements)->toHaveCount(7)
        ->and($statements->take(6)->map(fn (TeamHealthStatement $statement) => $statement->builtin?->value)->all())
        ->toBe(array_map(fn (HealthStatement $statement) => $statement->value, HealthStatement::cases()))
        ->and($statements->pluck('position')->all())->toBe([0, 1, 2, 3, 4, 5, 6])
        ->and($statements->last()->only(['text', 'label']))->toBe(['text' => 'We shipped what we promised', 'label' => 'Delivery']);
});

it('validates statement text and axis label lengths', function (array $payload, string $field) {
    [$user, , $team] = healthStatementTeam();

    $this->actingAs($user)->post(healthStatementRoute('store', $team), $payload)->assertSessionHasErrors($field);

    expect(TeamHealthStatement::count())->toBe(0);
})->with([
    'text too long' => [['text' => str_repeat('a', 151), 'label' => 'Axis'], 'text'],
    'label too long' => [['text' => 'Fine', 'label' => str_repeat('a', 31)], 'label'],
    'missing label' => [['text' => 'Fine'], 'label'],
]);

it('rewords a custom statement and keeps its id', function () {
    [$user, , $team] = healthStatementTeam();
    $custom = TeamHealthStatement::factory()->for($team)->create(['position' => 0]);
    TeamHealthStatement::factory()->for($team)->count(2)->create(['position' => 1]);

    $this->actingAs($user)
        ->patch(healthStatementRoute('update', $team, ['statement' => $custom->id]), ['text' => 'Reworded', 'label' => 'New axis'])
        ->assertSessionHasNoErrors();

    expect($custom->fresh()->only(['id', 'text', 'label']))->toBe(['id' => $custom->id, 'text' => 'Reworded', 'label' => 'New axis']);
});

it('refuses to reword a built-in statement', function () {
    [$user, , $team] = healthStatementTeam();

    $this->actingAs($user)
        ->patch(healthStatementRoute('update', $team, ['statement' => 'vision']), ['text' => 'Reworded', 'label' => 'Vision'])
        ->assertSessionHasErrors(['text' => 'Built-in statements cannot be reworded.']);

    expect($team->healthStatements()->where('builtin', 'vision')->sole()->text)->toBeNull();
});

it('reorders active statements, addressing virtual built-ins by their value', function () {
    [$user, , $team] = healthStatementTeam();
    $reversed = array_reverse(array_map(fn (HealthStatement $statement) => $statement->value, HealthStatement::cases()));

    $this->actingAs($user)
        ->put(healthStatementRoute('order.update', $team), ['ids' => $reversed])
        ->assertSessionHasNoErrors();

    expect(activeHealthKeys($team))->toBe($reversed);

    $ids = $team->healthStatements()->pluck('id')->reverse()->values()->all();

    $this->actingAs($user)->put(healthStatementRoute('order.update', $team), ['ids' => $ids])->assertSessionHasNoErrors();

    expect(activeHealthKeys($team))->toBe(array_reverse($reversed));
});

it('refuses an order that does not list every active statement exactly once', function (array $ids) {
    [$user, , $team] = healthStatementTeam();

    $this->actingAs($user)->put(healthStatementRoute('order.update', $team), ['ids' => $ids])->assertSessionHasErrors('ids');
})->with([
    'missing one' => [['interaction', 'task_clarity', 'manager_support', 'vision', 'processes']],
    'duplicate' => [['interaction', 'interaction', 'task_clarity', 'manager_support', 'vision', 'processes']],
    'unknown' => [['interaction', 'task_clarity', 'manager_support', 'vision', 'processes', 'nope']],
]);

it('archives and restores a statement, restored ones going last', function () {
    [$user, , $team] = healthStatementTeam();

    $this->actingAs($user)->put(healthStatementRoute('archival.update', $team, ['statement' => 'interaction']))->assertSessionHasNoErrors();

    expect(activeHealthKeys($team))->not->toContain('interaction')
        ->and($team->healthStatements()->count())->toBe(6);

    $this->actingAs($user)->delete(healthStatementRoute('archival.destroy', $team, ['statement' => 'interaction']))->assertSessionHasNoErrors();

    expect(activeHealthKeys($team))->toBe(['task_clarity', 'manager_support', 'vision', 'processes', 'motivation', 'interaction']);
});

it('keeps between 3 and 10 active statements', function () {
    [$user, , $team] = healthStatementTeam();

    foreach (['interaction', 'task_clarity', 'manager_support'] as $statement) {
        $this->actingAs($user)->put(healthStatementRoute('archival.update', $team, ['statement' => $statement]))->assertSessionHasNoErrors();
    }

    $this->actingAs($user)
        ->put(healthStatementRoute('archival.update', $team, ['statement' => 'vision']))
        ->assertSessionHasErrors(['statements' => 'A team needs between 3 and 10 health check statements.']);

    foreach (range(1, 7) as $number) {
        $this->actingAs($user)->post(healthStatementRoute('store', $team), ['text' => "Custom {$number}", 'label' => "Axis {$number}"])->assertSessionHasNoErrors();
    }

    expect(activeHealthKeys($team))->toHaveCount(10);

    $this->actingAs($user)
        ->post(healthStatementRoute('store', $team), ['text' => 'One too many', 'label' => 'Extra'])
        ->assertSessionHasErrors(['statements' => 'A team needs between 3 and 10 health check statements.']);

    $this->actingAs($user)
        ->delete(healthStatementRoute('archival.destroy', $team, ['statement' => 'interaction']))
        ->assertSessionHasErrors(['statements' => 'A team needs between 3 and 10 health check statements.']);
});

it('caps a team at 30 statements including archived ones', function () {
    [$user, , $team] = healthStatementTeam();
    TeamHealthStatement::factory()->for($team)->count(3)->create();
    TeamHealthStatement::factory()->for($team)->archived()->count(27)->create();

    $this->actingAs($user)
        ->post(healthStatementRoute('store', $team), ['text' => 'Thirty-first', 'label' => 'Extra'])
        ->assertSessionHasErrors(['text' => 'A team can have at most 30 health check statements, archived ones included.']);
});

it('lets only workspace owners and admins manage statements', function () {
    [$member, , $team] = healthStatementTeam(WorkspaceRole::Member);

    $this->actingAs($member)->post(healthStatementRoute('store', $team), ['text' => 'Nope', 'label' => 'Nope'])->assertForbidden();
    $this->actingAs($member)->patch(healthStatementRoute('update', $team, ['statement' => 'vision']), ['text' => 'Nope', 'label' => 'Nope'])->assertForbidden();
    $this->actingAs($member)->put(healthStatementRoute('order.update', $team), ['ids' => []])->assertForbidden();
    $this->actingAs($member)->put(healthStatementRoute('archival.update', $team, ['statement' => 'vision']))->assertForbidden();
    $this->actingAs($member)->delete(healthStatementRoute('archival.destroy', $team, ['statement' => 'vision']))->assertForbidden();

    [$outsider] = healthStatementTeam();

    $this->actingAs($outsider)->post(healthStatementRoute('store', $team), ['text' => 'Nope', 'label' => 'Nope'])->assertForbidden();

    expect(TeamHealthStatement::count())->toBe(0);
});

it('returns 404 for statements of another team or unknown values', function (callable $statement) {
    [$user, , $team] = healthStatementTeam();
    $foreign = TeamHealthStatement::factory()->create();

    $this->actingAs($user)
        ->put(healthStatementRoute('archival.update', $team, ['statement' => $statement($foreign)]))
        ->assertNotFound();
})->with([
    'another team' => [fn (TeamHealthStatement $foreign) => $foreign->id],
    'unknown value' => [fn () => 'happiness'],
]);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamHealthStatementsTest.php`
Expected: FAIL with `Route [teams.healthStatements.store] not defined.`

- [ ] **Step 3: Create the read side and presenter**

`app/Actions/HealthCheck/TeamHealthStatements.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Enums\HealthStatement;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use Illuminate\Support\Collection;

class TeamHealthStatements
{
    /**
     * @return Collection<int, TeamHealthStatement>
     */
    public function all(Team $team): Collection
    {
        $stored = $team->healthStatements()->get();

        if ($stored->isNotEmpty()) {
            return $stored->toBase();
        }

        return $this->defaults();
    }

    /**
     * @return Collection<int, TeamHealthStatement>
     */
    public function active(Team $team): Collection
    {
        return $this->all($team)
            ->reject(fn (TeamHealthStatement $statement) => $statement->isArchived())
            ->values();
    }

    /**
     * Unsaved rows standing for a team that never changed its statements.
     *
     * @return Collection<int, TeamHealthStatement>
     */
    public function defaults(): Collection
    {
        return collect(HealthStatement::cases())->map(fn (HealthStatement $statement, int $position) => new TeamHealthStatement([
            'builtin' => $statement,
            'position' => $position,
        ]));
    }
}
```

`app/Actions/HealthCheck/PresentHealthStatement.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Enums\HealthStatement;
use App\Models\RetroHealthStatement;
use App\Models\TeamHealthStatement;

class PresentHealthStatement
{
    /**
     * @return array{
     *     key: string,
     *     label: string,
     *     text: string,
     *     isBuiltin: bool
     * }
     */
    public function handle(RetroHealthStatement|TeamHealthStatement|HealthStatement $statement): array
    {
        if ($statement instanceof HealthStatement) {
            return [
                'key' => $statement->value,
                'label' => $statement->label(),
                'text' => $statement->text(),
                'isBuiltin' => true,
            ];
        }

        if ($statement->builtin !== null) {
            return $this->handle($statement->builtin);
        }

        return [
            'key' => $statement instanceof RetroHealthStatement ? $statement->key : $statement->key(),
            'label' => (string) $statement->label,
            'text' => (string) $statement->text,
            'isBuiltin' => false,
        ];
    }
}
```

- [ ] **Step 4: Create the write side**

`app/Actions/HealthCheck/ManageTeamHealthStatements.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Enums\HealthStatement;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ManageTeamHealthStatements
{
    public const MinimumActive = 3;

    public const MaximumActive = 10;

    public const MaximumTotal = 30;

    public function __construct(private TeamHealthStatements $teamHealthStatements) {}

    public function add(Team $team, string $text, string $label): TeamHealthStatement
    {
        return $this->change($team, function (Team $locked) use ($text, $label): TeamHealthStatement {
            $all = $locked->healthStatements()->get();

            if ($all->count() >= self::MaximumTotal) {
                throw ValidationException::withMessages([
                    'text' => __('A team can have at most 30 health check statements, archived ones included.'),
                ]);
            }

            $this->ensureActiveCount($this->activeOf($all)->count() + 1);

            return $locked->healthStatements()->create([
                'text' => $text,
                'label' => $label,
                'position' => (int) $all->max('position') + 1,
            ]);
        });
    }

    public function reword(Team $team, string $statement, string $text, string $label): TeamHealthStatement
    {
        return $this->change($team, function (Team $locked) use ($statement, $text, $label): TeamHealthStatement {
            $found = $this->find($locked, $statement);

            if ($found->isBuiltin()) {
                throw ValidationException::withMessages(['text' => __('Built-in statements cannot be reworded.')]);
            }

            $found->update(['text' => $text, 'label' => $label]);

            return $found;
        });
    }

    /**
     * @param  array<int, string>  $ids  row ids or built-in values, every active statement once
     */
    public function reorder(Team $team, array $ids): void
    {
        $this->change($team, function (Team $locked) use ($ids): void {
            $active = $this->activeOf($locked->healthStatements()->get());

            $ordered = collect($ids)->map(fn (string $id) => $this->match($active, $id));

            $resolvedIds = $ordered->map(fn (?TeamHealthStatement $statement) => $statement?->id)->all();
            $activeIds = $active->pluck('id')->all();

            sort($resolvedIds);
            sort($activeIds);

            if ($ordered->contains(null) || $resolvedIds !== $activeIds) {
                throw ValidationException::withMessages(['ids' => __('Send every active health check statement exactly once.')]);
            }

            $ordered->each(fn (TeamHealthStatement $statement, int $position) => $statement->update(['position' => $position]));
        });
    }

    public function archive(Team $team, string $statement): void
    {
        $this->change($team, function (Team $locked) use ($statement): void {
            $found = $this->find($locked, $statement);

            if ($found->isArchived()) {
                return;
            }

            $this->ensureActiveCount($this->activeOf($locked->healthStatements()->get())->count() - 1);

            $found->update(['archived_at' => now()]);
        });
    }

    public function restore(Team $team, string $statement): void
    {
        $this->change($team, function (Team $locked) use ($statement): void {
            $found = $this->find($locked, $statement);

            if (! $found->isArchived()) {
                return;
            }

            $all = $locked->healthStatements()->get();

            $this->ensureActiveCount($this->activeOf($all)->count() + 1);

            $found->update(['archived_at' => null, 'position' => (int) $all->max('position') + 1]);
        });
    }

    /**
     * @template TResult
     *
     * @param  callable(Team): TResult  $change
     * @return TResult
     */
    private function change(Team $team, callable $change): mixed
    {
        return DB::transaction(function () use ($team, $change): mixed {
            $locked = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            $this->materialize($locked);

            return $change($locked);
        });
    }

    private function materialize(Team $team): void
    {
        if ($team->healthStatements()->exists()) {
            return;
        }

        foreach ($this->teamHealthStatements->defaults() as $statement) {
            $team->healthStatements()->create([
                'builtin' => $statement->builtin,
                'position' => $statement->position,
            ]);
        }
    }

    private function find(Team $team, string $statement): TeamHealthStatement
    {
        $found = $this->match($team->healthStatements()->get(), $statement);

        abort_if($found === null, 404);

        return $found;
    }

    /**
     * @param  Collection<int, TeamHealthStatement>  $statements
     */
    private function match(Collection $statements, string $statement): ?TeamHealthStatement
    {
        $builtin = HealthStatement::tryFrom($statement);

        if ($builtin !== null) {
            return $statements->first(fn (TeamHealthStatement $candidate) => $candidate->builtin === $builtin);
        }

        if (! Str::isUuid($statement)) {
            return null;
        }

        return $statements->firstWhere('id', $statement);
    }

    /**
     * @param  Collection<int, TeamHealthStatement>  $statements
     * @return Collection<int, TeamHealthStatement>
     */
    private function activeOf(Collection $statements): Collection
    {
        return $statements->reject(fn (TeamHealthStatement $statement) => $statement->isArchived())->values();
    }

    private function ensureActiveCount(int $count): void
    {
        if ($count >= self::MinimumActive && $count <= self::MaximumActive) {
            return;
        }

        throw ValidationException::withMessages(['statements' => __('A team needs between 3 and 10 health check statements.')]);
    }
}
```

- [ ] **Step 5: Create the controllers**

`app/Http/Controllers/TeamHealthStatementsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class TeamHealthStatementsController extends Controller
{
    public function __construct(private ManageTeamHealthStatements $manageTeamHealthStatements) {}

    public function store(Request $request, Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('update', $team);

        $validated = $request->validate($this->rules());

        $this->manageTeamHealthStatements->add($team, $validated['text'], $validated['label']);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Statement added.')]);

        return back();
    }

    public function update(Request $request, Workspace $workspace, Team $team, string $statement): RedirectResponse
    {
        Gate::authorize('update', $team);

        $validated = $request->validate($this->rules());

        $this->manageTeamHealthStatements->reword($team, $statement, $validated['text'], $validated['label']);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Statement updated.')]);

        return back();
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function rules(): array
    {
        return [
            'text' => ['required', 'string', 'max:150'],
            'label' => ['required', 'string', 'max:30'],
        ];
    }
}
```

`app/Http/Controllers/TeamHealthStatementOrdersController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class TeamHealthStatementOrdersController extends Controller
{
    public function update(Request $request, Workspace $workspace, Team $team, ManageTeamHealthStatements $manageTeamHealthStatements): RedirectResponse
    {
        Gate::authorize('update', $team);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'string', 'max:64', 'distinct'],
        ]);

        $manageTeamHealthStatements->reorder($team, $validated['ids']);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Statements reordered.')]);

        return back();
    }
}
```

`app/Http/Controllers/TeamHealthStatementArchivalsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class TeamHealthStatementArchivalsController extends Controller
{
    public function __construct(private ManageTeamHealthStatements $manageTeamHealthStatements) {}

    public function update(Workspace $workspace, Team $team, string $statement): RedirectResponse
    {
        Gate::authorize('update', $team);

        $this->manageTeamHealthStatements->archive($team, $statement);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Statement archived.')]);

        return back();
    }

    public function destroy(Workspace $workspace, Team $team, string $statement): RedirectResponse
    {
        Gate::authorize('update', $team);

        $this->manageTeamHealthStatements->restore($team, $statement);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Statement restored.')]);

        return back();
    }
}
```

The `ids` required rule makes `['ids' => []]` a 422 for a manager; the member test still gets 403 because `Gate::authorize` runs before validation.

- [ ] **Step 6: Register the routes**

In `routes/web.php`, import the three controllers and add inside the `w/{workspace}` group, after the `teams.members.*` routes:

```php
            Route::post('teams/{team}/health-statements', [TeamHealthStatementsController::class, 'store'])->name('teams.healthStatements.store');
            Route::patch('teams/{team}/health-statements/{statement}', [TeamHealthStatementsController::class, 'update'])->name('teams.healthStatements.update')->where('statement', '[A-Za-z0-9_-]{1,64}');
            Route::put('teams/{team}/health-statement-order', [TeamHealthStatementOrdersController::class, 'update'])->name('teams.healthStatements.order.update');
            Route::put('teams/{team}/health-statements/{statement}/archival', [TeamHealthStatementArchivalsController::class, 'update'])->name('teams.healthStatements.archival.update')->where('statement', '[A-Za-z0-9_-]{1,64}');
            Route::delete('teams/{team}/health-statements/{statement}/archival', [TeamHealthStatementArchivalsController::class, 'destroy'])->name('teams.healthStatements.archival.destroy')->where('statement', '[A-Za-z0-9_-]{1,64}');
```

- [ ] **Step 7: Add translations**

Add the rows "A team needs between 3 and 10 health check statements." through "Statement restored." of the translation table.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamHealthStatementsTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse, regenerate routes and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail artisan wayfinder:generate --with-form
git add app/Actions/HealthCheck app/Http/Controllers routes/web.php resources/js/actions resources/js/routes lang tests/Feature/Teams/TeamHealthStatementsTest.php
git commit -m "feat: let owners and admins manage a team's health check statements

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 3: Freeze the team's statements into a retro

**Files:**
- Create: `app/Actions/HealthCheck/FreezeHealthStatements.php`
- Modify: `app/Actions/Retros/CreateRetro.php` (Plan 8a version), `app/Http/Controllers/Retros/RetroSettingsController.php` (Plan 8a version)
- Test: create `tests/Feature/Retros/HealthStatementFreezeTest.php`

**Interfaces:**
- Consumes: `TeamHealthStatements::active()` (Task 2), `ManageTeamHealthStatements` (Task 2, in tests), Plan 8a `CreateRetro` / `NewRetro::$healthCheckEnabled` and `RetroSettingsController` toggle validation.
- Produces: `FreezeHealthStatements::handle(Retro $retro): void` — copies the team's active statements into `retro_health_statements` (key, `team_health_statement_id`, builtin, text, label, position) unless the retro has answers; replaces an existing unanswered set. Called by `CreateRetro` when `$data->healthCheckEnabled`, and by `RetroSettingsController` when `health_check_enabled` goes from false to true. Must run inside the caller's transaction.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/HealthStatementFreezeTest.php`:

```php
<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\HealthStatement;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\HealthCheckAnswer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array<int, string>
 */
function frozenHealthKeys(Retro $retro): array
{
    return $retro->healthStatements()->pluck('key')->all();
}

function builtinHealthKeys(): array
{
    return array_map(fn (HealthStatement $statement) => $statement->value, HealthStatement::cases());
}

it('freezes the six built-ins when a retro is created with the health check', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Member)->create();
    $team = Team::factory()->for($workspace)->withMember($user)->create();

    $this->actingAs($user)->post(route('teams.retros.store', [$workspace, $team]), [
        'title' => 'Sprint 12',
        'template' => 'start_stop_continue',
        'health_check_enabled' => true,
    ])->assertRedirect();

    $retro = $team->retros()->sole();

    expect($retro->phase)->toBe(RetroPhase::HealthCheck)
        ->and(frozenHealthKeys($retro))->toBe(builtinHealthKeys());
});

it('freezes nothing for a retro created without the health check', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Member)->create();
    $team = Team::factory()->for($workspace)->withMember($user)->create();

    $this->actingAs($user)->post(route('teams.retros.store', [$workspace, $team]), [
        'title' => 'Sprint 12',
        'template' => 'start_stop_continue',
    ])->assertRedirect();

    expect(frozenHealthKeys($team->retros()->sole()))->toBe([]);
});

it('freezes the team active statements, custom ones with their text and id', function () {
    $retro = Retro::factory()->create();
    $manage = app(ManageTeamHealthStatements::class);
    $custom = $manage->add($retro->team, 'We shipped what we promised', 'Delivery');
    $manage->archive($retro->team, 'manager_support');

    app(FreezeHealthStatements::class)->handle($retro);

    $frozen = $retro->healthStatements()->get();

    expect($frozen->pluck('key')->all())->toBe(['interaction', 'task_clarity', 'vision', 'processes', 'motivation', $custom->id])
        ->and($frozen->pluck('position')->all())->toBe([0, 1, 2, 3, 4, 5])
        ->and($frozen->last()->only(['team_health_statement_id', 'text', 'label']))->toBe([
            'team_health_statement_id' => $custom->id,
            'text' => 'We shipped what we promised',
            'label' => 'Delivery',
        ]);
});

it('freezes the set when the facilitator turns the health check on', function () {
    $retro = Retro::factory()->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['health_check_enabled' => true])->assertNoContent();

    expect(frozenHealthKeys($retro))->toBe(builtinHealthKeys());
});

it('refreshes an unanswered set when the health check is turned on again', function () {
    $retro = Retro::factory()->create();
    [$user] = retroFacilitator($retro);
    $settings = route('retros.settings.update', $retro);

    $this->actingAs($user)->patchJson($settings, ['health_check_enabled' => true])->assertNoContent();

    $custom = app(ManageTeamHealthStatements::class)->add($retro->team, 'New question', 'New');

    $this->actingAs($user)->patchJson($settings, ['health_check_enabled' => false])->assertNoContent();
    $this->actingAs($user)->patchJson($settings, ['health_check_enabled' => true])->assertNoContent();

    expect(frozenHealthKeys($retro))->toBe([...builtinHealthKeys(), $custom->id]);
});

it('keeps the frozen set once answered, whatever the team changes', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroFacilitator($retro);
    $settings = route('retros.settings.update', $retro);

    $this->actingAs($user)->patchJson($settings, ['health_check_enabled' => true])->assertNoContent();

    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'statement' => 'vision', 'score' => 8]);

    $manage = app(ManageTeamHealthStatements::class);
    $manage->archive($retro->team, 'vision');
    $manage->add($retro->team, 'Added later', 'Later');

    $this->actingAs($user)->patchJson($settings, ['health_check_enabled' => false])->assertNoContent();
    $this->actingAs($user)->patchJson($settings, ['health_check_enabled' => true])->assertNoContent();

    expect(frozenHealthKeys($retro))->toBe(builtinHealthKeys())
        ->and($retro->healthCheckAnswers()->sole()->only(['statement', 'score']))->toBe(['statement' => 'vision', 'score' => 8]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/HealthStatementFreezeTest.php`
Expected: FAIL with `Class "App\Actions\HealthCheck\FreezeHealthStatements" not found` (and the endpoint tests fail because nothing is frozen).

- [ ] **Step 3: Create the action**

`app/Actions/HealthCheck/FreezeHealthStatements.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Models\Retro;

class FreezeHealthStatements
{
    public function __construct(private TeamHealthStatements $teamHealthStatements) {}

    /**
     * Answers refer to the frozen keys, so a set that has answers is never replaced.
     */
    public function handle(Retro $retro): void
    {
        if ($retro->healthCheckAnswers()->exists()) {
            return;
        }

        $retro->healthStatements()->delete();

        foreach ($this->teamHealthStatements->active($retro->team) as $position => $statement) {
            $retro->healthStatements()->create([
                'key' => $statement->key(),
                'team_health_statement_id' => $statement->id,
                'builtin' => $statement->builtin,
                'text' => $statement->text,
                'label' => $statement->label,
                'position' => $position,
            ]);
        }
    }
}
```

- [ ] **Step 4: Call it from retro creation**

In `app/Actions/Retros/CreateRetro.php` inject the action (constructor promotion; if Plan 8a already added a constructor, append the parameter):

```php
    public function __construct(private FreezeHealthStatements $freezeHealthStatements) {}
```

and inside the transaction, after the columns are created and before the retro is returned:

```php
            if ($data->healthCheckEnabled) {
                $this->freezeHealthStatements->handle($retro);
            }
```

Import `App\Actions\HealthCheck\FreezeHealthStatements`.

- [ ] **Step 5: Call it from the settings controller**

In `app/Http/Controllers/Retros/RetroSettingsController.php` inject the action (append to Plan 8a's constructor if there is one):

```php
    public function __construct(private FreezeHealthStatements $freezeHealthStatements) {}
```

and replace the `$locked->update($validated);` line inside the transaction with:

```php
            $wasHealthCheckEnabled = $locked->health_check_enabled;

            $locked->update($validated);

            if (! $wasHealthCheckEnabled && $locked->health_check_enabled) {
                $this->freezeHealthStatements->handle($locked);
            }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/HealthStatementFreezeTest.php tests/Feature/Retros/FacilitationTest.php tests/Feature/Retros/CreateRetroTest.php`
Expected: PASS.

- [ ] **Step 7: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/HealthCheck/FreezeHealthStatements.php app/Actions/Retros/CreateRetro.php app/Http/Controllers/Retros/RetroSettingsController.php tests/Feature/Retros/HealthStatementFreezeTest.php
git commit -m "feat: freeze a team's health check statements into each retro

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 4: Answering, live progress, broadcast and snapshot

**Files:**
- Create: `app/Http/Controllers/Retros/HealthCheckAnswersController.php`
- Create: `app/Actions/HealthCheck/PresentHealthProgress.php`, `app/Actions/HealthCheck/PresentHealthCheck.php`
- Create: `app/Events/Retros/HealthAnswered.php`
- Modify: `routes/web.php`, `app/Actions/Retros/BuildBoardSnapshot.php`
- Test: create `tests/Feature/Retros/HealthCheckTest.php`

**Interfaces:**
- Consumes: Task 1 models, Task 2 `PresentHealthStatement`, Task 3 `FreezeHealthStatements`; `RetroGuard::phase()`, `RetroGuard::unlocked()`; Plan 8a `RetroFactory::withHealthCheck()`.
- Produces:
  - `PUT /retros/{retro}/health-check/{statement}` `{score}` (route `retros.health-check.update`) → `{statement, score, statements: [{key, count, answeredBy}]}`; `DELETE` same path (route `retros.health-check.destroy`) → `{statements: [...]}`.
  - `PresentHealthProgress::handle(Retro $retro): array<int, array{key: string, count: int, answeredBy: array<int, string>}>` (`answeredBy` `[]` on anonymous retros, ids in answer order otherwise).
  - `PresentHealthCheck::handle(Retro $retro, Participant $viewer): ?array{statements: array<int, array{key, label, text, isBuiltin, count, answeredBy, myScore}>}` (null unless the health check is enabled or answers exist).
  - `App\Events\Retros\HealthAnswered(string $retroId, array $statements)` → `health.answered` `{statements}`.
  - Snapshot key `healthCheck`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/HealthCheckTest.php`:

```php
<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Events\Retros\HealthAnswered;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamHealthStatement;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function healthCheckRetro(array $attributes = []): Retro
{
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::HealthCheck)->create($attributes);

    app(FreezeHealthStatements::class)->handle($retro);

    return $retro->fresh();
}

function healthAnswerRoute(Retro $retro, string $statement): string
{
    return route('retros.health-check.update', ['retro' => $retro, 'statement' => $statement]);
}

it('sets, changes and clears the own score for one statement', function () {
    $retro = healthCheckRetro();
    [$user, $participant] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'vision'), ['score' => 7])
        ->assertOk()
        ->assertJsonPath('statement', 'vision')
        ->assertJsonPath('score', 7)
        ->assertJsonPath('statements.3', ['key' => 'vision', 'count' => 1, 'answeredBy' => [$participant->id]]);

    $this->actingAs($user)->deleteJson(route('retros.health-check.destroy', ['retro' => $retro, 'statement' => 'vision']))
        ->assertOk()
        ->assertJsonPath('statements.3', ['key' => 'vision', 'count' => 0, 'answeredBy' => []]);

    expect(HealthCheckAnswer::count())->toBe(0);
});

it('changes a score without duplicating the answer', function () {
    $retro = healthCheckRetro();
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'vision'), ['score' => 3])->assertOk();
    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'vision'), ['score' => 9])
        ->assertOk()
        ->assertJsonPath('statements.3.count', 1);

    expect(HealthCheckAnswer::sole()->score)->toBe(9);
});

it('lets guests answer', function () {
    $retro = healthCheckRetro(['guest_access_enabled' => true]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->putJson(healthAnswerRoute($retro, 'motivation'), ['score' => 10])
        ->assertOk();

    expect(HealthCheckAnswer::sole()->participant_id)->toBe($guest->id);
});

it('accepts scores from 1 to 10 only', function (mixed $score) {
    $retro = healthCheckRetro();
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'vision'), ['score' => $score])->assertUnprocessable()->assertJsonValidationErrors('score');
})->with([0, 11, 'high', null]);

it('returns 404 for statements outside the retro set', function (callable $statement) {
    $retro = healthCheckRetro();
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, $statement()), ['score' => 5])->assertNotFound();

    expect(HealthCheckAnswer::count())->toBe(0);
})->with([
    'unknown value' => [fn () => 'happiness'],
    'another team custom statement' => [fn () => TeamHealthStatement::factory()->create()->id],
]);

it('only accepts answers during the health check and while unlocked', function (RetroPhase $phase, array $attributes, int $status) {
    $retro = healthCheckRetro(['phase' => $phase, ...$attributes]);
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'vision'), ['score' => 5])->assertStatus($status);
})->with([
    'writing' => [RetroPhase::Writing, [], 403],
    'completed' => [RetroPhase::Completed, [], 403],
    'locked' => [RetroPhase::HealthCheck, ['is_locked' => true], 423],
]);

it('broadcasts counts and who answered, never a score', function () {
    $retro = healthCheckRetro();
    [$user, $participant] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'processes'), ['score' => 4])->assertOk();

    Event::assertDispatched(HealthAnswered::class, function (HealthAnswered $event) use ($participant) {
        $processes = collect($event->broadcastWith()['statements'])->firstWhere('key', 'processes');

        return $event->broadcastAs() === 'health.answered'
            && $processes === ['key' => 'processes', 'count' => 1, 'answeredBy' => [$participant->id]]
            && ! str_contains(json_encode($event->broadcastWith()), 'score');
    });
});

it('hides who answered on anonymous retros', function () {
    $retro = healthCheckRetro(['is_anonymous' => true]);
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(healthAnswerRoute($retro, 'processes'), ['score' => 4])
        ->assertJsonPath('statements.4', ['key' => 'processes', 'count' => 1, 'answeredBy' => []]);

    Event::assertDispatched(HealthAnswered::class, fn (HealthAnswered $event) => collect($event->broadcastWith()['statements'])
        ->every(fn (array $statement) => $statement['answeredBy'] === []));
});

it('sends each viewer only their own score in the snapshot', function () {
    $retro = healthCheckRetro();
    [, $viewer] = retroMember($retro);
    [, $other] = retroMember($retro);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $other->id, 'statement' => 'vision', 'score' => 2]);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $viewer->id, 'statement' => 'motivation', 'score' => 9]);

    $statements = collect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['healthCheck']['statements'])->keyBy('key');

    expect(array_keys($statements['vision']))->toBe(['key', 'label', 'text', 'isBuiltin', 'count', 'answeredBy', 'myScore'])
        ->and($statements['vision']['count'])->toBe(1)
        ->and($statements['vision']['answeredBy'])->toBe([$other->id])
        ->and($statements['vision']['myScore'])->toBeNull()
        ->and($statements['motivation']['myScore'])->toBe(9)
        ->and($statements['motivation']['label'])->toBe('Motivation');
});

it('leaves the health check out of the snapshot when it is off and unanswered', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);

    expect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['healthCheck'])->toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/HealthCheckTest.php`
Expected: FAIL with `Route [retros.health-check.update] not defined.`

- [ ] **Step 3: Create the presenters**

`app/Actions/HealthCheck/PresentHealthProgress.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Models\HealthCheckAnswer;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use Illuminate\Support\Collection;

class PresentHealthProgress
{
    /**
     * @return array<int, array{
     *     key: string,
     *     count: int,
     *     answeredBy: array<int, string>
     * }>
     */
    public function handle(Retro $retro): array
    {
        $answersByStatement = $retro->healthCheckAnswers()
            ->orderBy('created_at')
            ->get(['participant_id', 'statement'])
            ->groupBy('statement');

        return $retro->healthStatements()->get(['key'])->map(function (RetroHealthStatement $statement) use ($retro, $answersByStatement) {
            /** @var Collection<int, HealthCheckAnswer> $answers */
            $answers = $answersByStatement->get($statement->key, collect());

            return [
                'key' => $statement->key,
                'count' => $answers->count(),
                'answeredBy' => $retro->is_anonymous ? [] : $answers->pluck('participant_id')->values()->all(),
            ];
        })->values()->all();
    }
}
```

`app/Actions/HealthCheck/PresentHealthCheck.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroHealthStatement;

class PresentHealthCheck
{
    public function __construct(
        private PresentHealthStatement $presentHealthStatement,
        private PresentHealthProgress $presentHealthProgress,
    ) {}

    /**
     * @return array{
     *     statements: array<int, array{
     *         key: string,
     *         label: string,
     *         text: string,
     *         isBuiltin: bool,
     *         count: int,
     *         answeredBy: array<int, string>,
     *         myScore: ?int
     *     }>
     * }|null
     */
    public function handle(Retro $retro, Participant $viewer): ?array
    {
        if (! $retro->health_check_enabled && ! $retro->healthCheckAnswers()->exists()) {
            return null;
        }

        $progress = collect($this->presentHealthProgress->handle($retro))->keyBy('key');
        $myScores = $retro->healthCheckAnswers()->where('participant_id', $viewer->id)->pluck('score', 'statement');

        return [
            'statements' => $retro->healthStatements()->get()->map(function (RetroHealthStatement $statement) use ($progress, $myScores) {
                $presented = $this->presentHealthStatement->handle($statement);

                return [
                    ...$presented,
                    'count' => $progress[$statement->key]['count'] ?? 0,
                    'answeredBy' => $progress[$statement->key]['answeredBy'] ?? [],
                    'myScore' => isset($myScores[$statement->key]) ? (int) $myScores[$statement->key] : null,
                ];
            })->values()->all(),
        ];
    }
}
```

- [ ] **Step 4: Create the event**

`app/Events/Retros/HealthAnswered.php`:

```php
<?php

namespace App\Events\Retros;

class HealthAnswered extends RetroBroadcastEvent
{
    /**
     * @param  array<int, array{key: string, count: int, answeredBy: array<int, string>}>  $statements
     */
    public function __construct(string $retroId, public array $statements)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'health.answered';
    }

    public function broadcastWith(): array
    {
        return ['statements' => $this->statements];
    }
}
```

- [ ] **Step 5: Create the controller**

`app/Http/Controllers/Retros/HealthCheckAnswersController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\HealthCheck\PresentHealthProgress;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\HealthAnswered;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HealthCheckAnswersController extends Controller
{
    public function __construct(private PresentHealthProgress $presentHealthProgress) {}

    public function update(Request $request, Retro $retro, string $statement): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $validated = $request->validate([
            'score' => ['required', 'integer', 'min:1', 'max:10'],
        ]);

        $score = (int) $validated['score'];

        $progress = DB::transaction(function () use ($retro, $participant, $statement, $score): array {
            $locked = $this->lock($retro, $statement);

            $locked->healthCheckAnswers()->updateOrCreate(
                ['participant_id' => $participant->id, 'statement' => $statement],
                ['score' => $score],
            );

            return $this->broadcastProgress($locked);
        });

        return response()->json(['statement' => $statement, 'score' => $score, 'statements' => $progress]);
    }

    public function destroy(Request $request, Retro $retro, string $statement): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $progress = DB::transaction(function () use ($retro, $participant, $statement): array {
            $locked = $this->lock($retro, $statement);

            $locked->healthCheckAnswers()
                ->where('participant_id', $participant->id)
                ->where('statement', $statement)
                ->delete();

            return $this->broadcastProgress($locked);
        });

        return response()->json(['statements' => $progress]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::HealthCheck);
        RetroGuard::unlocked($retro);
    }

    private function lock(Retro $retro, string $statement): Retro
    {
        $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

        $this->guard($locked);

        abort_unless($locked->healthStatements()->where('key', $statement)->exists(), 404);

        return $locked;
    }

    /**
     * @return array<int, array{key: string, count: int, answeredBy: array<int, string>}>
     */
    private function broadcastProgress(Retro $retro): array
    {
        $progress = $this->presentHealthProgress->handle($retro);

        (new HealthAnswered($retro->id, $progress))->sendToOthers();

        return $progress;
    }
}
```

- [ ] **Step 6: Register the routes**

In `routes/web.php`, import `HealthCheckAnswersController` and add inside the `retros/{retro}` group, after the `retros.snapshot.show` route:

```php
        Route::put('health-check/{statement}', [HealthCheckAnswersController::class, 'update'])->name('retros.health-check.update')->where('statement', '[A-Za-z0-9_-]{1,64}');
        Route::delete('health-check/{statement}', [HealthCheckAnswersController::class, 'destroy'])->name('retros.health-check.destroy')->where('statement', '[A-Za-z0-9_-]{1,64}');
```

- [ ] **Step 7: Add the snapshot key**

In `app/Actions/Retros/BuildBoardSnapshot.php`, add `private PresentHealthCheck $presentHealthCheck,` to the constructor (import `App\Actions\HealthCheck\PresentHealthCheck`) and add after the `'actionItems' => …` entry:

```php
            'healthCheck' => $this->presentHealthCheck->handle($retro, $viewer),
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/HealthCheckTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: PASS (BoardSnapshotTest's constant-query test still passes: the health check adds a fixed number of queries).

- [ ] **Step 9: Format, analyse, regenerate routes and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
vendor/bin/sail artisan wayfinder:generate --with-form
git add app/Actions/HealthCheck app/Actions/Retros/BuildBoardSnapshot.php app/Events/Retros/HealthAnswered.php app/Http/Controllers/Retros/HealthCheckAnswersController.php routes/web.php resources/js/actions resources/js/routes tests/Feature/Retros/HealthCheckTest.php
git commit -m "feat: answer the health check with live progress and private scores

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 5: Health check aggregates

**Files:**
- Create: `app/Actions/HealthCheck/SummarizeHealthCheck.php`
- Modify: `lang/{en,fr,es,de}.json` (assessment and alignment strings)
- Test: create `tests/Feature/Retros/HealthCheckSummaryTest.php`

**Interfaces:**
- Consumes: Task 1 models, Task 2 `PresentHealthStatement` and `ManageTeamHealthStatements` (tests), Task 3 `FreezeHealthStatements`.
- Produces: `SummarizeHealthCheck::handle(Retro $retro): ?array` returning

  ```
  {
    statements: [{key, label, text, isBuiltin, average: ?float, count: int}],   // frozen set, in order
    score: float,                                                               // one decimal
    participation: {respondents: int, participants: int},
    topStrength: ?{key, label, average},
    growthArea: ?{key, label, average},
    alignment: {value: int, level: 'high'|'moderate'|'divided', label: string},
    assessment: {band: 'excellent'|'good'|'needs_attention'|'critical', title: string, sentence: string},
  }
  ```

  or `null` when `health_check_enabled` is false or no statement of the set has an answer. Plan 8d renders it; `SummarizeHealthCheck::statementMean(int $total, int $answers): float` is not exposed — Task 6 computes scores with the same rule (mean of unrounded statement means, rounded to one decimal).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/HealthCheckSummaryTest.php`:

```php
<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Enums\RetroPhase;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;

/**
 * @param  array<string, array<int, int|null>>  $scores  statement key => score per participant (null = skipped)
 */
function summarizedRetro(array $scores, int $silentParticipants = 0, ?Retro $retro = null): Retro
{
    $retro ??= Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create();

    if (! $retro->healthStatements()->exists()) {
        app(FreezeHealthStatements::class)->handle($retro);
    }

    $respondents = max(array_map('count', $scores ?: [[]]));
    $participants = Participant::factory()->count($respondents + $silentParticipants)->create(['retro_id' => $retro->id]);

    foreach ($scores as $statement => $statementScores) {
        foreach ($statementScores as $index => $score) {
            if ($score === null) {
                continue;
            }

            HealthCheckAnswer::factory()->create([
                'retro_id' => $retro->id,
                'participant_id' => $participants[$index]->id,
                'statement' => $statement,
                'score' => $score,
            ]);
        }
    }

    return $retro->fresh();
}

function healthSummary(Retro $retro): ?array
{
    return app(SummarizeHealthCheck::class)->handle($retro);
}

it('reports every answered statement and excludes the others', function () {
    $summary = healthSummary(summarizedRetro(['interaction' => [8, 6], 'task_clarity' => [4]]));
    $statements = collect($summary['statements'])->keyBy('key');

    expect($statements['interaction'])->toMatchArray(['average' => 7.0, 'count' => 2])
        ->and($statements['task_clarity'])->toMatchArray(['average' => 4.0, 'count' => 1, 'label' => 'Clear tasks'])
        ->and($statements['vision'])->toMatchArray(['average' => null, 'count' => 0])
        ->and($summary['score'])->toBe(5.5)
        ->and($summary['topStrength'])->toBe(['key' => 'interaction', 'label' => 'Interaction', 'average' => 7.0])
        ->and($summary['growthArea'])->toBe(['key' => 'task_clarity', 'label' => 'Clear tasks', 'average' => 4.0]);
});

it('reports an average from a single answer and no strength or growth area', function () {
    $summary = healthSummary(summarizedRetro(['vision' => [3]]));

    expect(collect($summary['statements'])->firstWhere('key', 'vision')['average'])->toBe(3.0)
        ->and($summary['score'])->toBe(3.0)
        ->and($summary['topStrength'])->toBeNull()
        ->and($summary['growthArea'])->toBeNull();
});

it('gives ties to the earlier statement and nothing when all averages are equal', function () {
    $tied = healthSummary(summarizedRetro(['interaction' => [7], 'task_clarity' => [7], 'vision' => [5], 'processes' => [5]]));
    $equal = healthSummary(summarizedRetro(['interaction' => [6], 'motivation' => [6]]));

    expect($tied['topStrength']['key'])->toBe('interaction')
        ->and($tied['growthArea']['key'])->toBe('vision')
        ->and($equal['topStrength'])->toBeNull()
        ->and($equal['growthArea'])->toBeNull();
});

it('counts participation over every participant of the retro', function () {
    $summary = healthSummary(summarizedRetro(['interaction' => [8, 6], 'vision' => [null, 5]], silentParticipants: 1));

    expect($summary['participation'])->toBe(['respondents' => 2, 'participants' => 3]);
});

it('computes alignment from the population standard deviation', function (array $scores, int $value, string $level, string $label) {
    expect(healthSummary(summarizedRetro($scores))['alignment'])->toBe(['value' => $value, 'level' => $level, 'label' => $label]);
})->with([
    'opposite and unanimous' => [['interaction' => [1, 10], 'vision' => [5, 5]], 5, 'moderate', 'Moderate consensus'],
    'close and unanimous' => [['interaction' => [6, 8], 'vision' => [5, 5]], 9, 'high', 'High team consensus'],
    'opposite only' => [['interaction' => [1, 10]], 0, 'divided', 'Divided opinions'],
    'single answer' => [['interaction' => [4]], 10, 'high', 'High team consensus'],
]);

it('assesses the score by band', function (array $scores, float $score, string $band, string $title) {
    $summary = healthSummary(summarizedRetro($scores));

    expect($summary['score'])->toBe($score)
        ->and($summary['assessment']['band'])->toBe($band)
        ->and($summary['assessment']['title'])->toBe($title);
})->with([
    'eight' => [['vision' => [8]], 8.0, 'excellent', 'Excellent'],
    'seven and a half' => [['vision' => [8, 7]], 7.5, 'good', 'Good'],
    'six' => [['vision' => [6]], 6.0, 'good', 'Good'],
    'five and a half' => [['vision' => [6, 5]], 5.5, 'needs_attention', 'Needs attention'],
    'four' => [['vision' => [4]], 4.0, 'needs_attention', 'Needs attention'],
    'three and a half' => [['vision' => [4, 3]], 3.5, 'critical', 'Critical'],
]);

it('explains the good band with the spec sentence', function () {
    expect(healthSummary(summarizedRetro(['vision' => [7]]))['assessment']['sentence'])
        ->toBe('Most health scores are above average. Keep the momentum going.');
});

it('summarises nothing when the health check is off or unanswered', function () {
    $answeredButOff = summarizedRetro(['vision' => [7]]);
    $answeredButOff->update(['health_check_enabled' => false]);

    expect(healthSummary($answeredButOff->fresh()))->toBeNull()
        ->and(healthSummary(summarizedRetro([])))->toBeNull();
});

it('summarises the frozen set of 3 and of 10 statements', function (int $customs, array $archived, int $expected) {
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create();
    $manage = app(ManageTeamHealthStatements::class);

    for ($number = 1; $number <= $customs; $number++) {
        $manage->add($retro->team, "Custom {$number}", "Axis {$number}");
    }

    foreach ($archived as $statement) {
        $manage->archive($retro->team, $statement);
    }

    app(FreezeHealthStatements::class)->handle($retro);

    $summary = healthSummary(summarizedRetro([$retro->healthStatements()->first()->key => [6]], retro: $retro));

    expect($summary['statements'])->toHaveCount($expected);
})->with([
    'three' => [0, ['interaction', 'task_clarity', 'manager_support'], 3],
    'ten' => [4, [], 10],
]);

it('labels custom statements as typed', function () {
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create();
    $custom = app(ManageTeamHealthStatements::class)->add($retro->team, 'We shipped what we promised', 'Delivery');
    app(FreezeHealthStatements::class)->handle($retro);

    $summary = healthSummary(summarizedRetro([$custom->id => [9], 'vision' => [3]], retro: $retro));

    expect($summary['topStrength'])->toBe(['key' => $custom->id, 'label' => 'Delivery', 'average' => 9.0])
        ->and(collect($summary['statements'])->firstWhere('key', $custom->id))->toMatchArray([
            'text' => 'We shipped what we promised',
            'isBuiltin' => false,
        ]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/HealthCheckSummaryTest.php`
Expected: FAIL with `Class "App\Actions\HealthCheck\SummarizeHealthCheck" not found`.

- [ ] **Step 3: Implement the aggregates**

`app/Actions/HealthCheck/SummarizeHealthCheck.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Models\Retro;
use App\Models\RetroHealthStatement;
use Illuminate\Support\Collection;

class SummarizeHealthCheck
{
    /** The largest population standard deviation on a 1–10 scale. */
    private const MaximumSpread = 4.5;

    public function __construct(private PresentHealthStatement $presentHealthStatement) {}

    /**
     * @return array{
     *     statements: array<int, array{key: string, label: string, text: string, isBuiltin: bool, average: ?float, count: int}>,
     *     score: float,
     *     participation: array{respondents: int, participants: int},
     *     topStrength: ?array{key: string, label: string, average: float},
     *     growthArea: ?array{key: string, label: string, average: float},
     *     alignment: array{value: int, level: string, label: string},
     *     assessment: array{band: string, title: string, sentence: string}
     * }|null
     */
    public function handle(Retro $retro): ?array
    {
        if (! $retro->health_check_enabled) {
            return null;
        }

        $totals = $retro->healthCheckAnswers()
            ->toBase()
            ->selectRaw('statement, count(*) as answers, sum(score) as total, sum(score * score) as squares')
            ->groupBy('statement')
            ->get()
            ->keyBy('statement');

        $statements = $retro->healthStatements()->get()->map(function (RetroHealthStatement $statement) use ($totals) {
            $row = $totals->get($statement->key);
            $count = (int) ($row->answers ?? 0);
            $mean = $count === 0 ? null : (float) $row->total / $count;

            return [
                ...$this->presentHealthStatement->handle($statement),
                'average' => $mean === null ? null : round($mean, 1),
                'count' => $count,
                'mean' => $mean,
                'consensus' => $mean === null ? null : $this->consensus((float) $row->squares / $count - $mean ** 2),
            ];
        });

        $reported = $statements->whereNotNull('mean')->values();

        if ($reported->isEmpty()) {
            return null;
        }

        $score = round((float) $reported->avg('mean'), 1);
        [$topStrength, $growthArea] = $this->extremes($reported);

        return [
            'statements' => $statements->map(fn (array $statement) => [
                'key' => $statement['key'],
                'label' => $statement['label'],
                'text' => $statement['text'],
                'isBuiltin' => $statement['isBuiltin'],
                'average' => $statement['average'],
                'count' => $statement['count'],
            ])->values()->all(),
            'score' => $score,
            'participation' => [
                'respondents' => $retro->healthCheckAnswers()->distinct()->count('participant_id'),
                'participants' => $retro->participants()->count(),
            ],
            'topStrength' => $topStrength,
            'growthArea' => $growthArea,
            'alignment' => $this->alignment((int) round((float) $reported->avg('consensus'))),
            'assessment' => $this->assessment($score),
        ];
    }

    private function consensus(float $variance): float
    {
        $spread = sqrt(max(0.0, $variance));

        return max(0.0, min(10.0, 10 * (1 - $spread / self::MaximumSpread)));
    }

    /**
     * @param  Collection<int, array{key: string, label: string, average: ?float}>  $reported
     * @return array{
     *     0: ?array{key: string, label: string, average: float},
     *     1: ?array{key: string, label: string, average: float}
     * }
     */
    private function extremes(Collection $reported): array
    {
        if ($reported->count() < 2) {
            return [null, null];
        }

        if ($reported->pluck('average')->unique()->count() === 1) {
            return [null, null];
        }

        $highest = $reported->reduce(fn (?array $best, array $statement) => $best === null || $statement['average'] > $best['average'] ? $statement : $best);
        $lowest = $reported->reduce(fn (?array $best, array $statement) => $best === null || $statement['average'] < $best['average'] ? $statement : $best);

        return [$this->extreme($highest), $this->extreme($lowest)];
    }

    /**
     * @param  array{key: string, label: string, average: ?float}  $statement
     * @return array{key: string, label: string, average: float}
     */
    private function extreme(array $statement): array
    {
        return ['key' => $statement['key'], 'label' => $statement['label'], 'average' => (float) $statement['average']];
    }

    /**
     * @return array{value: int, level: string, label: string}
     */
    private function alignment(int $value): array
    {
        return match (true) {
            $value >= 8 => ['value' => $value, 'level' => 'high', 'label' => __('High team consensus')],
            $value >= 5 => ['value' => $value, 'level' => 'moderate', 'label' => __('Moderate consensus')],
            default => ['value' => $value, 'level' => 'divided', 'label' => __('Divided opinions')],
        };
    }

    /**
     * @return array{band: string, title: string, sentence: string}
     */
    private function assessment(float $score): array
    {
        return match (true) {
            $score >= 8 => ['band' => 'excellent', 'title' => __('Excellent'), 'sentence' => __('The team is thriving. Keep doing what works.')],
            $score >= 6 => ['band' => 'good', 'title' => __('Good'), 'sentence' => __('Most health scores are above average. Keep the momentum going.')],
            $score >= 4 => ['band' => 'needs_attention', 'title' => __('Needs attention'), 'sentence' => __('Several areas need attention. Pick one to improve next.')],
            default => ['band' => 'critical', 'title' => __('Critical'), 'sentence' => __('The team is struggling. Talk about what would help most.')],
        };
    }
}
```

Ties and top/growth compare the one-decimal averages people see; the score averages the unrounded statement means.

- [ ] **Step 4: Add translations**

Add the rows "Excellent" through "Divided opinions" of the translation table.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/HealthCheckSummaryTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 6: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/HealthCheck/SummarizeHealthCheck.php lang tests/Feature/Retros/HealthCheckSummaryTest.php
git commit -m "feat: summarise health check answers into score, alignment and assessment

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 6: Team health trend

**Files:**
- Create: `app/Actions/HealthCheck/BuildHealthTrend.php`
- Test: create `tests/Feature/Retros/HealthTrendTest.php`

**Interfaces:**
- Consumes: Task 1 models, Task 2 `ManageTeamHealthStatements` (tests), Task 3 `FreezeHealthStatements`.
- Produces:
  - `BuildHealthTrend::handle(Retro $retro): array<int, array{retroId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}>` — the last 6 `Completed` retros of the retro's team with the health check enabled and at least one answer, oldest first; three queries whatever the number of retros.
  - `BuildHealthTrend::forViewer(Retro $retro, Participant $viewer): ?array` — `null` for guests, else `handle()` (Plan 8d uses this for `results.healthTrend`).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/HealthTrendTest.php`:

```php
<?php

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\RetroPhase;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Support\Facades\DB;

/**
 * @param  array<string, int>  $scores  statement key => one participant's score
 */
function trendRetro(Team $team, array $scores, string $completedAt, array $attributes = []): Retro
{
    $retro = Retro::factory()->for($team)->withHealthCheck()->inPhase(RetroPhase::Completed)->create([
        'completed_at' => $completedAt,
        ...$attributes,
    ]);

    app(FreezeHealthStatements::class)->handle($retro);

    $participant = Participant::factory()->create(['retro_id' => $retro->id]);

    foreach ($scores as $statement => $score) {
        HealthCheckAnswer::factory()->create([
            'retro_id' => $retro->id,
            'participant_id' => $participant->id,
            'statement' => $statement,
            'score' => $score,
        ]);
    }

    return $retro;
}

it('lists the last six scored completed retros of the team, oldest first, with deltas', function () {
    $team = Team::factory()->create();
    $retros = collect(range(1, 8))->map(fn (int $week) => trendRetro($team, ['vision' => $week, 'motivation' => $week + 1], "2026-0{$week}-01 10:00:00"));

    trendRetro(Team::factory()->create(), ['vision' => 10], '2026-08-15 10:00:00');
    trendRetro($team, ['vision' => 10], '2026-08-20 10:00:00', ['phase' => RetroPhase::Discussing]);
    trendRetro($team, ['vision' => 10], '2026-08-21 10:00:00', ['health_check_enabled' => false]);
    trendRetro($team, [], '2026-08-22 10:00:00');

    $trend = app(BuildHealthTrend::class)->handle($retros->last());

    expect(collect($trend)->pluck('retroId')->all())->toBe($retros->slice(2)->pluck('id')->values()->all())
        ->and(collect($trend)->pluck('score')->all())->toBe([3.5, 4.5, 5.5, 6.5, 7.5, 8.5])
        ->and(collect($trend)->pluck('delta')->all())->toBe([null, 1.0, 1.0, 1.0, 1.0, 1.0])
        ->and($trend[0])->toMatchArray([
            'title' => $retros[2]->title,
            'completedAt' => $retros[2]->completed_at->toIso8601String(),
            'url' => route('retros.show', $retros[2]),
            'sameStatements' => true,
        ]);
});

it('flags a point whose statement set differs from the previous one', function () {
    $team = Team::factory()->create();
    trendRetro($team, ['vision' => 6], '2026-05-01 10:00:00');

    app(ManageTeamHealthStatements::class)->archive($team, 'motivation');

    trendRetro($team, ['vision' => 7], '2026-06-01 10:00:00');
    $latest = trendRetro($team, ['vision' => 8], '2026-07-01 10:00:00');

    expect(collect(app(BuildHealthTrend::class)->handle($latest))->pluck('sameStatements')->all())->toBe([true, false, true]);
});

it('keeps a reworded custom statement comparable across retros', function () {
    $team = Team::factory()->create();
    $manage = app(ManageTeamHealthStatements::class);
    $custom = $manage->add($team, 'We shipped on time', 'Delivery');

    $first = trendRetro($team, [$custom->id => 5], '2026-05-01 10:00:00');

    $manage->reword($team, $custom->id, 'We shipped what we promised', 'Promises');

    $second = trendRetro($team, [$custom->id => 7], '2026-06-01 10:00:00');

    expect(collect(app(BuildHealthTrend::class)->handle($second))->pluck('sameStatements')->all())->toBe([true, true])
        ->and($first->healthStatements()->where('key', $custom->id)->sole()->text)->toBe('We shipped on time')
        ->and($second->healthStatements()->where('key', $custom->id)->sole()->text)->toBe('We shipped what we promised');
});

it('builds the trend with a constant number of queries', function () {
    $team = Team::factory()->create();
    $countQueries = function (Retro $retro): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        app(BuildHealthTrend::class)->handle($retro);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $small = $countQueries(trendRetro($team, ['vision' => 5], '2026-05-01 10:00:00'));

    foreach (range(6, 9) as $month) {
        $latest = trendRetro($team, ['vision' => 5, 'motivation' => 6, 'processes' => 7], "2026-0{$month}-01 10:00:00");
    }

    expect($countQueries($latest))->toBe($small);
});

it('never builds the trend for guests', function () {
    $retro = trendRetro(Team::factory()->create(), ['vision' => 5], '2026-05-01 10:00:00');
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    [, $member] = retroMember($retro);

    expect(app(BuildHealthTrend::class)->forViewer($retro, $guest))->toBeNull()
        ->and(app(BuildHealthTrend::class)->forViewer($retro, $member))->toHaveCount(1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/HealthTrendTest.php`
Expected: FAIL with `Class "App\Actions\HealthCheck\BuildHealthTrend" not found`.

- [ ] **Step 3: Implement the trend**

`app/Actions/HealthCheck/BuildHealthTrend.php`:

```php
<?php

namespace App\Actions\HealthCheck;

use App\Enums\RetroPhase;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use Illuminate\Support\Collection;

class BuildHealthTrend
{
    private const Points = 6;

    /**
     * Guests of one retro must not see the team's other retros.
     *
     * @return array<int, array{retroId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}>|null
     */
    public function forViewer(Retro $retro, Participant $viewer): ?array
    {
        if ($viewer->isGuest()) {
            return null;
        }

        return $this->handle($retro);
    }

    /**
     * @return array<int, array{retroId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}>
     */
    public function handle(Retro $retro): array
    {
        $retros = Retro::query()
            ->where('team_id', $retro->team_id)
            ->where('phase', RetroPhase::Completed)
            ->where('health_check_enabled', true)
            ->whereNotNull('completed_at')
            ->whereHas('healthCheckAnswers')
            ->orderByDesc('completed_at')
            ->limit(self::Points)
            ->get(['id', 'title', 'completed_at'])
            ->reverse()
            ->values();

        $retroIds = $retros->pluck('id');

        $keysByRetro = RetroHealthStatement::query()
            ->whereIn('retro_id', $retroIds)
            ->get(['retro_id', 'key'])
            ->groupBy('retro_id')
            ->map(fn (Collection $statements) => $statements->pluck('key')->sort()->values()->all());

        $meansByRetro = HealthCheckAnswer::query()
            ->toBase()
            ->whereIn('retro_id', $retroIds)
            ->selectRaw('retro_id, statement, sum(score) as total, count(*) as answers')
            ->groupBy('retro_id', 'statement')
            ->get()
            ->groupBy('retro_id');

        $points = [];
        $previous = null;

        foreach ($retros as $point) {
            $keys = $keysByRetro->get($point->id, []);

            $means = collect($meansByRetro->get($point->id, []))
                ->filter(fn (object $row) => in_array($row->statement, $keys, true))
                ->map(fn (object $row) => (float) $row->total / (int) $row->answers);

            if ($means->isEmpty()) {
                continue;
            }

            $score = round((float) $means->avg(), 1);

            $points[] = [
                'retroId' => $point->id,
                'title' => $point->title,
                'completedAt' => $point->completed_at->toIso8601String(),
                'score' => $score,
                'url' => route('retros.show', $point->id),
                'delta' => $previous === null ? null : round($score - $previous['score'], 1),
                'sameStatements' => $previous === null || $previous['keys'] === $keys,
            ];

            $previous = ['score' => $score, 'keys' => $keys];
        }

        return $points;
    }
}
```

`completed_at` is non-null on these rows (`whereNotNull`), so the non-nullsafe `->toIso8601String()` is safe; if phpstan flags `Carbon|null`, add `/** @var Carbon $completedAt */` via a local variable rather than `?->`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/HealthTrendTest.php`
Expected: PASS.

- [ ] **Step 5: Format, analyse and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/HealthCheck/BuildHealthTrend.php tests/Feature/Retros/HealthTrendTest.php
git commit -m "feat: build the team health trend across completed retros

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 7: Team page — "Health check statements" section

**Files:**
- Modify: `app/Http/Controllers/TeamsController.php`
- Modify: `resources/js/types/workspaces.ts`, `resources/js/pages/teams/show.tsx`
- Create: `resources/js/components/teams/health-statements-section.tsx`
- Modify: `lang/{en,fr,es,de}.json` (team page strings)
- Test: `tests/Feature/Teams/TeamsTest.php`

**Interfaces:**
- Consumes: Task 2 `TeamHealthStatements::all()`, `PresentHealthStatement`, routes `teams.healthStatements.*` (Wayfinder: `TeamHealthStatementsController.store/update`, `TeamHealthStatementOrdersController.update`, `TeamHealthStatementArchivalsController.update/destroy`).
- Produces: `teams/show` props `healthStatements: TeamHealthStatement[]` (`{id, key, label, text, isBuiltin, isArchived}`; `id` is the row id, or the built-in value for a team that never changed its statements) and `canManageHealthStatements: boolean`; TS type `TeamHealthStatement` in `resources/js/types/workspaces.ts`; component `HealthStatementsSection`.

- [ ] **Step 1: Write the failing test**

Append to `tests/Feature/Teams/TeamsTest.php`:

```php
it('shows the team health check statements to every team member', function () {
    $member = User::factory()->create();
    $workspace = workspaceWith($member, WorkspaceRole::Member);
    $team = Team::factory()->for($workspace)->withMember($member)->create();

    $this->actingAs($member)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('healthStatements', 6)
            ->where('healthStatements.0', [
                'id' => 'interaction',
                'key' => 'interaction',
                'label' => 'Interaction',
                'text' => 'Interaction with colleagues was productive',
                'isBuiltin' => true,
                'isArchived' => false,
            ])
            ->where('canManageHealthStatements', false));
});

it('lists archived statements with their row ids for managers', function () {
    $admin = User::factory()->create();
    $workspace = workspaceWith($admin, WorkspaceRole::Admin);
    $team = Team::factory()->for($workspace)->create();
    app(\App\Actions\HealthCheck\ManageTeamHealthStatements::class)->archive($team, 'vision');
    $vision = $team->healthStatements()->where('builtin', 'vision')->sole();

    $this->actingAs($admin)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('healthStatements.3.id', $vision->id)
            ->where('healthStatements.3.isArchived', true)
            ->where('canManageHealthStatements', true));
});
```

Import `App\Actions\HealthCheck\ManageTeamHealthStatements` at the top of the file instead of the fully qualified name.

- [ ] **Step 2: Run the test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamsTest.php`
Expected: FAIL — `Property [healthStatements] does not exist`.

- [ ] **Step 3: Add the props**

In `app/Http/Controllers/TeamsController.php` add a constructor:

```php
    public function __construct(
        private TeamHealthStatements $teamHealthStatements,
        private PresentHealthStatement $presentHealthStatement,
    ) {}
```

(imports `App\Actions\HealthCheck\TeamHealthStatements`, `App\Actions\HealthCheck\PresentHealthStatement`, `App\Models\TeamHealthStatement`) and add to the `Inertia::render('teams/show', [...])` array, after `'canCreateRetro' => …`:

```php
            'healthStatements' => $this->teamHealthStatements->all($team)->map(fn (TeamHealthStatement $statement) => [
                'id' => $statement->id ?? $statement->key(),
                ...$this->presentHealthStatement->handle($statement),
                'isArchived' => $statement->isArchived(),
            ])->values(),
            'canManageHealthStatements' => $request->user()->can('update', $team),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams/TeamsTest.php`
Expected: PASS.

- [ ] **Step 5: Add the TS type**

Append to `resources/js/types/workspaces.ts`:

```ts
export type TeamHealthStatement = {
    id: string;
    key: string;
    label: string;
    text: string;
    isBuiltin: boolean;
    isArchived: boolean;
};
```

- [ ] **Step 6: Create the section component**

`resources/js/components/teams/health-statements-section.tsx`:

```tsx
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type Announcements,
    type DragEndEvent,
    type UniqueIdentifier,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Form, router, usePage } from '@inertiajs/react';
import { GripVertical } from 'lucide-react';
import { useState } from 'react';
import TeamHealthStatementArchivalsController from '@/actions/App/Http/Controllers/TeamHealthStatementArchivalsController';
import TeamHealthStatementOrdersController from '@/actions/App/Http/Controllers/TeamHealthStatementOrdersController';
import TeamHealthStatementsController from '@/actions/App/Http/Controllers/TeamHealthStatementsController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { TeamHealthStatement } from '@/types';

type Params = { workspace: string; team: string };

type Props = {
    statements: TeamHealthStatement[];
    canManage: boolean;
    params: Params;
};

export function HealthStatementsSection({
    statements,
    canManage,
    params,
}: Props) {
    const { t } = useTrans();
    const { errors } = usePage().props as {
        errors: Record<string, string | undefined>;
    };
    const active = statements.filter((statement) => !statement.isArchived);
    const archived = statements.filter((statement) => statement.isArchived);
    const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
    const ordered = pendingOrder
        ? pendingOrder
              .map((id) => active.find((statement) => statement.id === id))
              .filter(
                  (statement): statement is TeamHealthStatement =>
                      statement !== undefined,
              )
        : active;
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const labelOf = (id: UniqueIdentifier | undefined): string =>
        ordered.find((statement) => statement.id === id)?.label ?? '';

    const announcements: Announcements = {
        onDragStart: ({ active: dragged }) =>
            t('Picked up :statement.', { statement: labelOf(dragged.id) }),
        onDragOver: ({ active: dragged, over }) =>
            over
                ? t('Moved :statement to position :position.', {
                      statement: labelOf(dragged.id),
                      position:
                          ordered.findIndex(
                              (statement) => statement.id === over.id,
                          ) + 1,
                  })
                : undefined,
        onDragEnd: ({ active: dragged }) =>
            t('Dropped :statement.', { statement: labelOf(dragged.id) }),
        onDragCancel: () => t('Reordering cancelled.'),
    };

    const handleDragEnd = ({ active: dragged, over }: DragEndEvent) => {
        if (!over || dragged.id === over.id) {
            return;
        }

        const ids = ordered.map((statement) => statement.id);
        const next = arrayMove(
            ids,
            ids.indexOf(String(dragged.id)),
            ids.indexOf(String(over.id)),
        );

        setPendingOrder(next);
        router.put(
            TeamHealthStatementOrdersController.update.url(params),
            { ids: next },
            { preserveScroll: true, onFinish: () => setPendingOrder(null) },
        );
    };

    return (
        <section className="space-y-3">
            <Heading
                variant="small"
                title={t('Health check statements')}
                description={t(
                    'Changes apply to retros that have not collected answers yet.',
                )}
            />

            <InputError message={errors.statements ?? errors.ids} />

            <DndContext
                id="health-statements"
                sensors={sensors}
                collisionDetection={closestCenter}
                accessibility={{
                    announcements,
                    screenReaderInstructions: {
                        draggable: t(
                            'To pick up a statement, press Space or Enter. Use the arrow keys to move it, Space or Enter to drop it, or Escape to cancel.',
                        ),
                    },
                }}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={ordered.map((statement) => statement.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <ol className="divide-y rounded-md border">
                        {ordered.map((statement) => (
                            <StatementRow
                                key={statement.id}
                                statement={statement}
                                canManage={canManage}
                                params={params}
                            />
                        ))}
                    </ol>
                </SortableContext>
            </DndContext>

            {canManage && (
                <Form
                    {...TeamHealthStatementsController.store.form(params)}
                    options={{ preserveScroll: true }}
                    resetOnSuccess
                    className="flex flex-wrap items-start gap-2"
                >
                    {({ processing, errors: formErrors }) => (
                        <>
                            <div className="min-w-64 flex-1">
                                <Input
                                    name="text"
                                    required
                                    maxLength={150}
                                    placeholder={t('Statement')}
                                    aria-label={t('Statement')}
                                />
                                <InputError message={formErrors.text} />
                            </div>
                            <div className="w-40">
                                <Input
                                    name="label"
                                    required
                                    maxLength={30}
                                    placeholder={t('Axis label')}
                                    aria-label={t('Axis label')}
                                />
                                <InputError message={formErrors.label} />
                            </div>
                            <Button disabled={processing}>
                                {t('Add statement')}
                            </Button>
                        </>
                    )}
                </Form>
            )}

            {archived.length > 0 && (
                <Collapsible>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                            {t('Archived (:count)', {
                                count: archived.length,
                            })}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <ul className="divide-y rounded-md border">
                            {archived.map((statement) => (
                                <li
                                    key={statement.id}
                                    className="flex items-center justify-between gap-3 p-3 text-muted-foreground"
                                >
                                    <StatementText statement={statement} />
                                    {canManage && (
                                        <Form
                                            {...TeamHealthStatementArchivalsController.destroy.form(
                                                {
                                                    ...params,
                                                    statement: statement.id,
                                                },
                                            )}
                                            options={{ preserveScroll: true }}
                                        >
                                            {({ processing }) => (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={processing}
                                                >
                                                    {t('Restore')}
                                                </Button>
                                            )}
                                        </Form>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </section>
    );
}

function StatementText({ statement }: { statement: TeamHealthStatement }) {
    const { t } = useTrans();

    return (
        <div className="min-w-0 flex-1">
            <div className="break-words">{statement.text}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{statement.label}</span>
                {statement.isBuiltin && (
                    <Badge variant="secondary">{t('Built-in')}</Badge>
                )}
            </div>
        </div>
    );
}

function StatementRow({
    statement,
    canManage,
    params,
}: {
    statement: TeamHealthStatement;
    canManage: boolean;
    params: Params;
}) {
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: statement.id, disabled: !canManage });

    return (
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className="flex items-center gap-3 bg-background p-3 data-[dragging=true]:opacity-60"
            data-dragging={isDragging}
        >
            {canManage && (
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    className="cursor-grab text-muted-foreground"
                    aria-label={t('Drag to reorder')}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" />
                </button>
            )}

            {editing ? (
                <Form
                    {...TeamHealthStatementsController.update.form({
                        ...params,
                        statement: statement.id,
                    })}
                    options={{ preserveScroll: true }}
                    onSuccess={() => setEditing(false)}
                    className="flex flex-1 flex-wrap items-start gap-2"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="min-w-48 flex-1">
                                <Input
                                    name="text"
                                    required
                                    maxLength={150}
                                    defaultValue={statement.text}
                                    aria-label={t('Statement')}
                                />
                                <InputError message={errors.text} />
                            </div>
                            <div className="w-36">
                                <Input
                                    name="label"
                                    required
                                    maxLength={30}
                                    defaultValue={statement.label}
                                    aria-label={t('Axis label')}
                                />
                                <InputError message={errors.label} />
                            </div>
                            <Button size="sm" disabled={processing}>
                                {t('Save')}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditing(false)}
                            >
                                {t('Cancel')}
                            </Button>
                        </>
                    )}
                </Form>
            ) : (
                <StatementText statement={statement} />
            )}

            {canManage && !editing && (
                <div className="flex shrink-0 gap-1">
                    {!statement.isBuiltin && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(true)}
                        >
                            {t('Edit')}
                        </Button>
                    )}
                    <Form
                        {...TeamHealthStatementArchivalsController.update.form({
                            ...params,
                            statement: statement.id,
                        })}
                        options={{ preserveScroll: true }}
                    >
                        {({ processing }) => (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={processing}
                            >
                                {t('Archive')}
                            </Button>
                        )}
                    </Form>
                </div>
            )}
        </li>
    );
}
```

If the Inertia v3 `Form` component in this repo names its prop `resetOnSuccess` differently, check `search-docs` (`form component reset`) and match; keep the behaviour (clear the add form after success).

- [ ] **Step 7: Render it on the team page**

In `resources/js/pages/teams/show.tsx`: add `TeamHealthStatement` to the type import from `@/types`, add to `Props`:

```ts
    healthStatements: TeamHealthStatement[];
    canManageHealthStatements: boolean;
```

destructure both, import `HealthStatementsSection` from `@/components/teams/health-statements-section`, and render it between the Retrospectives section and the Members section:

```tsx
                <HealthStatementsSection
                    statements={healthStatements}
                    canManage={canManageHealthStatements}
                    params={params}
                />
```

- [ ] **Step 8: Add translations**

Add the rows "Health check statements" through "Reordering cancelled." of the translation table.

- [ ] **Step 9: Run the checks**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Teams tests/Feature/TranslationKeysTest.php && npm run types:check && npm run check`
Expected: PASS (only the known pre-existing `check` failures).

- [ ] **Step 10: Format and commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
npx vp fmt resources/js/components/teams/health-statements-section.tsx resources/js/pages/teams/show.tsx resources/js/types/workspaces.ts
git add app/Http/Controllers/TeamsController.php resources/js lang tests/Feature/Teams/TeamsTest.php
git commit -m "feat: manage health check statements from the team page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 8: Health check phase on the board

**Files:**
- Modify: `resources/js/lib/retro/types.ts`, `resources/js/lib/retro/board-reducer.ts`
- Modify: `resources/js/hooks/use-retro-channel.ts`, `resources/js/hooks/use-retro-board.ts`
- Create: `resources/js/components/retro/health-check-panel.tsx`
- Modify: `resources/js/components/retro/phase-panel.tsx`, `resources/js/components/retro/settings-dialog.tsx`, `resources/js/components/teams/new-retro-dialog.tsx`
- Modify: `lang/{en,fr,es,de}.json` (panel strings)
- Test: `tests/Feature/TranslationKeysTest.php` (existing)

**Interfaces:**
- Consumes: snapshot `healthCheck` and `health.answered` (Task 4); Wayfinder `HealthCheckAnswersController.update/destroy({retro, statement})`; Plan 8a `PhasePanel` (`phase-panel.tsx`), `SettingsForm`, `NewRetroDialog`.
- Produces: TS types `HealthStatementPayload`, `HealthProgress`, `HealthCheckStatement`, `HealthCheckState`; `Snapshot.healthCheck: HealthCheckState | null`; reducer actions `{ type: 'health.progress'; statements: HealthProgress[] }` and `{ type: 'health.answer'; key: string; score: number | null }`; component `HealthCheckPanel`.

- [ ] **Step 1: Add the types**

In `resources/js/lib/retro/types.ts` add before `Snapshot`:

```ts
export type HealthStatementPayload = {
    key: string;
    label: string;
    text: string;
    isBuiltin: boolean;
};

export type HealthProgress = {
    key: string;
    count: number;
    answeredBy: string[];
};

export type HealthCheckStatement = HealthStatementPayload &
    HealthProgress & { myScore: number | null };

export type HealthCheckState = { statements: HealthCheckStatement[] };
```

and add to `Snapshot` after `actionItems`:

```ts
    healthCheck: HealthCheckState | null;
```

- [ ] **Step 2: Add the reducer actions**

In `resources/js/lib/retro/board-reducer.ts` import `HealthProgress`, add to `BoardAction`:

```ts
    | { type: 'health.progress'; statements: HealthProgress[] }
    | { type: 'health.answer'; key: string; score: number | null };
```

and the cases at the end of the `switch`:

```ts
        case 'health.progress': {
            if (!state.healthCheck) {
                return state;
            }

            const progress = new Map(
                action.statements.map((statement) => [statement.key, statement]),
            );

            return {
                ...state,
                healthCheck: {
                    statements: state.healthCheck.statements.map((statement) => {
                        const update = progress.get(statement.key);

                        return update
                            ? {
                                  ...statement,
                                  count: update.count,
                                  answeredBy: update.answeredBy,
                              }
                            : statement;
                    }),
                },
            };
        }
        case 'health.answer':
            if (!state.healthCheck) {
                return state;
            }

            return {
                ...state,
                healthCheck: {
                    statements: state.healthCheck.statements.map((statement) =>
                        statement.key === action.key
                            ? { ...statement, myScore: action.score }
                            : statement,
                    ),
                },
            };
```

- [ ] **Step 3: Listen to `health.answered`**

In `resources/js/hooks/use-retro-channel.ts` append `'health.answered',` to `RetroEvents`. In `resources/js/hooks/use-retro-board.ts` import `HealthProgress` and add to the `onEvent` switch before `'phase.changed'`:

```ts
                case 'health.answered':
                    apply({
                        type: 'health.progress',
                        statements: payload.statements as HealthProgress[],
                    });
                    break;
```

- [ ] **Step 4: Create the panel**

`resources/js/components/retro/health-check-panel.tsx`:

```tsx
import { Check } from 'lucide-react';
import { useState } from 'react';
import HealthCheckAnswersController from '@/actions/App/Http/Controllers/Retros/HealthCheckAnswersController';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { HealthCheckStatement, HealthProgress } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';

const Scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const VisibleAvatars = 8;

export function HealthCheckPanel() {
    const { board } = useBoard();
    const { t } = useTrans();
    const statements = board.healthCheck?.statements ?? [];

    return (
        <main className="mx-auto w-full max-w-3xl space-y-4 p-4">
            <header className="space-y-1">
                <h2 className="text-lg font-semibold">{t('Health check')}</h2>
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Rate each statement from 1 (Awful) to 10 (Great). Only you see your own scores.',
                    )}
                </p>
            </header>
            <ol className="space-y-3">
                {statements.map((statement) => (
                    <HealthStatementRow
                        key={statement.key}
                        statement={statement}
                    />
                ))}
            </ol>
        </main>
    );
}

function HealthStatementRow({
    statement,
}: {
    statement: HealthCheckStatement;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const retroId = ctx.board.retro.id;
    const disabled = busy || !ctx.isEditable;
    const respondents = statement.answeredBy
        .map((id) =>
            ctx.board.participants.find((participant) => participant.id === id),
        )
        .filter((participant) => participant !== undefined);

    const answer = async (score: number | null) => {
        if (busy) {
            return;
        }

        setBusy(true);
        ctx.dispatch({ type: 'health.answer', key: statement.key, score });

        const route =
            score === null
                ? HealthCheckAnswersController.destroy({
                      retro: retroId,
                      statement: statement.key,
                  })
                : HealthCheckAnswersController.update({
                      retro: retroId,
                      statement: statement.key,
                  });

        const response = await ctx.run(
            retroRequest<{ statements: HealthProgress[] }>(
                route,
                score === null ? undefined : { score },
            ),
        );

        setBusy(false);

        if (response) {
            ctx.apply({ type: 'health.progress', statements: response.statements });
        }
    };

    return (
        <li className="space-y-3 rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
                <p className="font-medium break-words">{statement.text}</p>
                {statement.myScore !== null && (
                    <Check
                        className="size-5 shrink-0 text-primary"
                        aria-label={t('Answered')}
                    />
                )}
            </div>

            <div
                role="radiogroup"
                aria-label={statement.text}
                className="grid grid-cols-5 gap-1 sm:grid-cols-10"
            >
                {Scores.map((score) => (
                    <Button
                        key={score}
                        type="button"
                        role="radio"
                        aria-checked={statement.myScore === score}
                        aria-label={t('Score :score', { score })}
                        variant={
                            statement.myScore === score ? 'default' : 'outline'
                        }
                        size="sm"
                        disabled={disabled}
                        onClick={() => void answer(score)}
                    >
                        {score}
                    </Button>
                ))}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('Awful')}</span>
                <span>{t('Great')}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex -space-x-2">
                        {respondents.slice(0, VisibleAvatars).map((participant) => (
                            <Tooltip key={participant.id}>
                                <TooltipTrigger asChild>
                                    <img
                                        src={participant.avatarUrl}
                                        alt={participant.name}
                                        className="size-6 rounded-full border-2 border-background bg-muted"
                                    />
                                </TooltipTrigger>
                                <TooltipContent>{participant.name}</TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                    <span className={cn(statement.count === 0 && 'opacity-70')}>
                        {t(':count answered', { count: statement.count })}
                    </span>
                </div>
                {statement.myScore !== null && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() => void answer(null)}
                    >
                        {t('Clear')}
                    </Button>
                )}
            </div>
        </li>
    );
}
```

On anonymous retros `answeredBy` is `[]`, so only the count renders.

- [ ] **Step 5: Render the panel and add the Health check switches**

Plan 8a ships the backend toggle only: its `PhasePanel` has no `health_check` branch and neither dialog offers the switch. Add all three here.

Replace `resources/js/components/retro/phase-panel.tsx` (created by Plan 8a) with:

```tsx
import { useBoard } from './board-context';
import { HealthCheckPanel } from './health-check-panel';
import { IcebreakerPanel } from './icebreaker-panel';

export function PhasePanel() {
    const { board } = useBoard();

    switch (board.retro.phase) {
        case 'health_check':
            return <HealthCheckPanel />;
        case 'icebreaker':
            return <IcebreakerPanel />;
        default:
            return null;
    }
}
```

`PhasePanel` is rendered above the columns (Plan 8a), so the facilitator can still prepare columns below the questions. Because it is not the page's main landmark, change the outer element of `HealthCheckPanel` from `<main className="mx-auto w-full max-w-3xl space-y-4 p-4">` to `<section className="mx-auto w-full max-w-3xl space-y-4 p-4">` (and its closing tag to `</section>`).

In `resources/js/components/retro/settings-dialog.tsx` (`SettingsForm`, as left by Plan 8a), add next to the `icebreakerEnabled` state:

```ts
    const [healthCheckEnabled, setHealthCheckEnabled] = useState(
        retro.healthCheckEnabled,
    );
```

next to the `icebreaker_enabled` change detection in `save`:

```ts
        if (healthCheckEnabled !== retro.healthCheckEnabled) {
            changes.health_check_enabled = healthCheckEnabled;
        }
```

and inside the `<div className="grid gap-2">` that holds the `retro-icebreaker` checkbox, before it:

```tsx
                <SettingCheckbox
                    id="retro-health-check"
                    label={t('Health check')}
                    checked={healthCheckEnabled}
                    disabled={engagementLocked}
                    onChange={setHealthCheckEnabled}
                />
```

In `resources/js/components/teams/new-retro-dialog.tsx` (Plan 8a): add `health_check_enabled: boolean;` to `type RetroForm` after `is_anonymous`, `health_check_enabled: false,` to the `useForm<RetroForm>` defaults after `is_anonymous: false,`, and in the Settings `CollapsibleContent`, before the `new-retro-icebreaker` block:

```tsx
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="new-retro-health-check"
                            checked={form.data.health_check_enabled}
                            onCheckedChange={(checked) =>
                                form.setData('health_check_enabled', checked === true)
                            }
                        />
                        <Label htmlFor="new-retro-health-check">
                            {t('Health check')}
                        </Label>
                    </div>
```

`TeamRetrosController` already accepts `health_check_enabled` (Plan 8a) and `CreateRetro` freezes the statements (Task 3).

- [ ] **Step 6: Add translations**

Add the rows "Health check" through "Score :score" of the translation table (skip "Health check" if Plan 8a already added it).

- [ ] **Step 7: Run the checks**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php && npm run types:check && npm run check`
Expected: PASS (only the known pre-existing `check` failures).

- [ ] **Step 8: Format and commit**

```bash
npx vp fmt resources/js/lib/retro/types.ts resources/js/lib/retro/board-reducer.ts resources/js/hooks/use-retro-channel.ts resources/js/hooks/use-retro-board.ts resources/js/components/retro/health-check-panel.tsx resources/js/components/retro/phase-panel.tsx resources/js/components/retro/settings-dialog.tsx resources/js/components/teams/new-retro-dialog.tsx
git add resources/js lang
git commit -m "feat: answer the health check on the board with live avatars

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 9: Verification (controller-driven)

- [ ] **Step 1: Run the affected suites**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/Teams tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS. Then ask the user to run the full suite: `vendor/bin/sail artisan test --compact`.

- [ ] **Step 2: Static checks**

Run: `vendor/bin/sail bin phpstan analyse --no-progress && npm run types:check && npm run check`
Expected: phpstan 0 errors; type-check clean; `check` only the known pre-existing failures.

- [ ] **Step 3: Manual two-browser walkthrough (one guest)**

With `composer run dev` (or `npm run build`):
1. As an Owner, open a team page: six built-ins listed; add a custom statement ("We shipped what we promised" / "Delivery"), archive "Manager support", drag a statement to a new position, reword the custom one, restore and archive again; the note "Changes apply to retros that have not collected answers yet." is shown. As a plain member: list is read-only.
2. Create a retro with the health check on (Plan 8a dialog): the stepper starts on "Health check"; the frozen set is the team's active list in order.
3. Enable guest access, join as a guest in a second browser; both answer: avatars and counts update live, no score of the other is visible anywhere (inspect the `health.answered` websocket frame and the snapshot JSON); "Clear" removes the own answer; a 10-button row wraps to two rows of five on a narrow window.
4. Turn on anonymity on another retro, answer: counts only, no avatars.
5. Close for editing: score buttons disabled; server answers 423 if forced.
6. Move to Writing and back: answering in Writing is refused (403 toast), back in Health check it works again.
7. Answer, then change the team statements and toggle the health check off/on: the retro keeps its set.

- [ ] **Step 4: Record carried minors**

List anything deferred during review for the user to decide (per the "ask when in doubt" preference); do not silently accept trade-offs.

---

## Notes

- `SummarizeHealthCheck` and `BuildHealthTrend` are not wired into any payload in this plan; Plan 8d builds `results.health` from `SummarizeHealthCheck::handle()` and `results.healthTrend` from `BuildHealthTrend::forViewer()`, and renders the radar, trend and cards.
- Only the "Good" assessment sentence is given by the spec; the "Excellent", "Needs attention" and "Critical" sentences are this plan's wording.
- Top strength / growth area compare the one-decimal averages shown to people (ties go to the earlier statement); the score is the mean of the unrounded statement means, rounded to one decimal; alignment rounds the mean per-statement consensus to an integer.

## Spec coverage

| Spec | Task |
|---|---|
| §3 `team_health_statements`, `retro_health_statements`, `health_check_answers` (unique keys, check constraint) | 1 |
| §4.1 statements enum, translated texts and axis labels, "Awful"/"Great" | 1, 8 |
| §4.2 answering: `HealthCheck` only (403), 423 locked, upsert / clear, partial answers, guests | 4 |
| §4.3 live progress: counts, answering ids (not on anonymous retros), no scores | 4, 8 |
| §4.4 aggregates: no minimum, averages, score, participation, top strength / growth area with ties and all-equal, alignment formula and levels, assessment bands | 5 |
| §4.5 trend: last 6 completed retros of the team, health enabled and scored, deltas, `sameStatements`, guests excluded, constant queries | 6 |
| §4.6 team statements: materialisation, custom add/reword (built-in → 422), reorder (virtual built-ins by value, 422 incomplete), archive/restore, 3–10 active, 30 total, managers only, frozen set on enable, refresh without answers / keep with answers, key identity across rewording, 404 outside the set, presented statement shape, team page section and note | 2, 3, 4, 7 |
| §10.1 `PUT/DELETE /health-check/{statement}` | 4 |
| §10.2 `health.answered` | 4, 8 |
| §10.3 snapshot `healthCheck` | 4, 8 |
| §11 health check / custom statements / trend redaction | 4, 6, 7 |
| §13 Health check phase UI, Team page statements section | 7, 8 |
| §15 Health check and Team health statements tests | 1–7 |
| §16 AC 3, 4 (aggregates and trend data; rendering in Plan 8d), 12 | 3–7 |
