# Plan 8c — Surveys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surveys on the retro board — single choice, multiple choice and free text — with results shown only after answering or closing, a facilitator "Show who answered" switch, close/reopen, automatic closing at completion, and emoji reactions plus threaded comments on surveys for viewers who can see the results.

**Architecture:** Six new tables (`surveys`, `survey_options`, `survey_responses`, `survey_text_answers`, `survey_reactions`, `survey_comments`) with models and factories. One presenter, `App\Actions\Surveys\PresentSurvey`, builds the per-viewer payload of spec §5.2 and does every redaction server-side (counts, voters, text answers, reactions, comments); it is used by every survey endpoint and by the board snapshot (constant query count through eager loading). Mutations follow the board pattern: guards on the route-bound retro, again on the `lockForUpdate` row inside `DB::transaction`, broadcast after commit with `->sendToOthers()`. Broadcasts never carry content: `survey.changed {surveyId, version, responseCount}`, `survey.deleted {surveyId}`, `survey.discussion.changed {surveyId, commentCount}`; clients refetch `GET /surveys/{id}` (debounced 1 s) when they are allowed to see more. Spec 1's `SummarizeReactions` and `PresentComment` are generalised to surveys, and spec 1's thread and reaction-chip UI is extracted into reusable components.

**Tech Stack:** Laravel 13 (PHP 8.4), Reverb, Pest, React 19, Inertia v3, `@laravel/echo-react`, Wayfinder, Tailwind 4, lucide, frimousse (already installed, through `EmojiPicker`).

**Spec:** `docs/superpowers/specs/2026-09-29-retro-flow-extras-design.md` §5.1, §5.2, §5.4, §5.5 and the survey parts of §3, §10, §11, §13, §14, §15, §16 (AC 5, 13, 14). §5.3 (LLM survey draft) is Plan 8e. Cross-plan contract: Plans 8a and 8b are implemented before this plan (`RetroPhase::isOpen()`, `HealthCheck`/`Icebreaker` phases, `App\Actions\Retros\ChangeRetroPhase`).

## Global Constraints

- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- No new Composer or npm dependency.
- Migrations: filenames `2026_10_01_120000_…` to `2026_10_01_120500_…`, only `up()`, UUID primary keys, `foreignUuid(...)->constrained()`.
- Ballot secrecy (spec §5.1, §11): unless `show_voters` is on, no survey payload or broadcast links a participant to an option or a text answer; with it on, voter ids and text authors are sent only together with the counts (viewer answered or survey closed) and never on anonymous retros. Broadcasts never carry options, texts, emoji, names or participant ids.
- Result visibility: a viewer receives counts, text answers, reactions and comments of a survey only when they answered it or it is closed (`resultsVisible`). Redaction is done server-side in `PresentSurvey`.
- Every mutation keeps the controller pattern: guards on the route-bound retro, then again on the `lockForUpdate` retro inside `DB::transaction`, broadcasts via `->sendToOthers()` inside the transaction.
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"); add only missing keys; `tests/Feature/TranslationKeysTest.php` stays green.
- Board API calls go through `retroRequest()`; Wayfinder route functions, no hard-coded URLs. Run `vendor/bin/sail artisan wayfinder:generate --with-form` after route changes.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp fmt <files>`; never `npx prettier` on the repo.
- React style: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `useBoard()` for board state.
- PHP style: constructor promotion, typed everything, array-shape docblocks for presenter return values, early returns, curly braces always, no comments that restate code. Class constants PascalCase.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Review Focus

1. **A participant withdraws their answer on an open survey** → counts, voters, text answers, reactions and comments are hidden from them again, and reacting or commenting → 403 "Answer the survey to join the discussion.". Pinned in Task 5 ("hides the discussion again after the viewer withdraws their answer").
2. **The retro becomes anonymous after the facilitator turned "Show who answered" on** → no voters, no text-answer authors and no reaction names, and `showVoters` is reported `false`. Pinned in Task 2 ("never sends voters, text authors or reaction names on anonymous retros").
3. **The facilitator reopens a completed retro** → every survey stays closed and answering → 422 "This survey is closed.". Pinned in Task 4 ("closes every open survey at completion and keeps them closed after a reopen").
4. **Free-text answers written in a different order and case** → answers are ordered by text case-insensitively, never by time or author. Pinned in Task 2 ("orders free-text answers by text and names authors only when allowed", answers created in reverse order).
5. **A survey is deleted while another participant answers, reacts or comments, or a URL is tampered with to reach another retro's survey** → 404 and nothing written; the client removes the survey on 404. Pinned in Task 4 ("returns 404 for a deleted survey or a survey of another retro") and Task 6 (refetcher `onGone`).

## File map

| Area | Files |
|---|---|
| Schema | `database/migrations/2026_10_01_1200{00..50}0_create_survey*_table.php` |
| Models | `app/Enums/SurveyKind.php`, `app/Models/{Survey,SurveyOption,SurveyResponse,SurveyTextAnswer,SurveyReaction,SurveyComment}.php`, `app/Models/Retro.php`, `database/factories/Survey*Factory.php` |
| Presentation | `app/Actions/Surveys/PresentSurvey.php`, `app/Actions/Retros/SummarizeReactions.php`, `app/Actions/Retros/PresentComment.php`, `app/Actions/Retros/BuildBoardSnapshot.php` |
| Rules | `app/Actions/Surveys/SurveyGuard.php`, `app/Actions/Surveys/CloseOpenSurveys.php`, `app/Actions/Retros/ChangeRetroPhase.php` |
| Endpoints | `app/Http/Controllers/Retros/{SurveysController,SurveyClosuresController,SurveyResponsesController,SurveyReactionsController,SurveyCommentsController}.php`, `routes/web.php` |
| Events | `app/Events/Retros/{SurveyChanged,SurveyDeleted,SurveyDiscussionChanged,OwnSurveyCommentSaved}.php`, `app/Events/Retros/CommentNotification.php` |
| Frontend core | `resources/js/lib/retro/{types,board-reducer,survey-api}.ts`, `resources/js/hooks/{use-retro-channel,use-retro-board}.ts` |
| Frontend shared | `resources/js/components/retro/{reaction-chips,comment-thread}.tsx` (extracted), `card-reactions.tsx`, `card-comments.tsx` |
| Frontend surveys | `resources/js/components/retro/{surveys-column,survey-card,survey-dialog,survey-menu,survey-discussion}.tsx`, `board.tsx`, `board-header.tsx` |
| Tests | `tests/Feature/Retros/{SurveyModelTest,SurveyPresentationTest,SurveysTest,SurveyAnswersTest,SurveyDiscussionTest}.php`, `tests/Pest.php` |

---

### Task 1: Survey schema, kind enum, models and factories

**Files:**
- Create: `database/migrations/2026_10_01_120000_create_surveys_table.php`, `2026_10_01_120100_create_survey_options_table.php`, `2026_10_01_120200_create_survey_responses_table.php`, `2026_10_01_120300_create_survey_text_answers_table.php`, `2026_10_01_120400_create_survey_reactions_table.php`, `2026_10_01_120500_create_survey_comments_table.php`
- Create: `app/Enums/SurveyKind.php`, `app/Models/{Survey,SurveyOption,SurveyResponse,SurveyTextAnswer,SurveyReaction,SurveyComment}.php`
- Create: `database/factories/{Survey,SurveyOption,SurveyResponse,SurveyTextAnswer,SurveyReaction,SurveyComment}Factory.php`
- Modify: `app/Models/Retro.php`
- Test: `tests/Feature/Retros/SurveyModelTest.php`

**Interfaces:**
- Consumes: `Retro`, `Participant` models and factories.
- Produces: `App\Enums\SurveyKind` (`Single='single'`, `Multiple='multiple'`, `Text='text'`, `isChoice(): bool`); `Retro::surveys(): HasMany<Survey>` ordered by `position`; `Retro::surveyComments(): HasMany<SurveyComment>`; `Survey` relations `retro()`, `createdBy()`, `options()` (ordered by position), `responses()`, `textAnswers()`, `reactions()` (oldest first), `comments()` (oldest first) and methods `responseCount(): int`, `commentCount(): int`, `answeredParticipantIds(): Collection<int, string>`, `hasAnswerFrom(Participant $participant): bool`, `isVisibleTo(Participant $participant): bool`; `SurveyComment::isDeleted(): bool`, `SurveyComment::threadId(): string`, `SurveyComment::replies()`; `SurveyFactory` states `single()`, `multiple()`, `text()`, `closed()`, `withOptions(array $labels = ['Yes', 'No', 'Maybe'])`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Retros/SurveyModelTest.php`:

```php
<?php

use App\Enums\SurveyKind;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyOption;
use App\Models\SurveyReaction;
use App\Models\SurveyResponse;
use App\Models\SurveyTextAnswer;

it('orders a retro surveys and their options by position', function () {
    $retro = Retro::factory()->create();
    $second = Survey::factory()->create(['retro_id' => $retro->id, 'position' => 1]);
    $first = Survey::factory()->withOptions(['A', 'B'])->create(['retro_id' => $retro->id, 'position' => 0]);

    expect($retro->surveys()->pluck('id')->all())->toBe([$first->id, $second->id])
        ->and($first->options()->pluck('label')->all())->toBe(['A', 'B'])
        ->and($first->fresh()->kind)->toBe(SurveyKind::Single);
});

it('counts respondents once and knows who answered', function () {
    $survey = Survey::factory()->multiple()->withOptions()->create();
    $voter = Participant::factory()->create(['retro_id' => $survey->retro_id]);
    $other = Participant::factory()->create(['retro_id' => $survey->retro_id]);

    foreach ($survey->options->take(2) as $option) {
        SurveyResponse::factory()->create(['survey_id' => $survey->id, 'survey_option_id' => $option->id, 'participant_id' => $voter->id]);
    }

    expect($survey->responseCount())->toBe(1)
        ->and($survey->hasAnswerFrom($voter))->toBeTrue()
        ->and($survey->hasAnswerFrom($other))->toBeFalse()
        ->and($survey->isVisibleTo($other))->toBeFalse()
        ->and($survey->answeredParticipantIds()->all())->toBe([$voter->id]);

    $survey->update(['is_closed' => true]);

    expect($survey->isVisibleTo($other))->toBeTrue();
});

it('counts free-text respondents and live comments', function () {
    $survey = Survey::factory()->text()->create();
    SurveyTextAnswer::factory()->count(2)->create(['survey_id' => $survey->id]);
    SurveyComment::factory()->create(['retro_id' => $survey->retro_id, 'survey_id' => $survey->id]);
    SurveyComment::factory()->create(['retro_id' => $survey->retro_id, 'survey_id' => $survey->id, 'content' => null, 'deleted_at' => now()]);

    expect($survey->responseCount())->toBe(2)
        ->and($survey->commentCount())->toBe(1);
});

it('deletes surveys with everything attached when the retro is deleted', function () {
    $survey = Survey::factory()->withOptions()->create();
    SurveyResponse::factory()->create(['survey_id' => $survey->id, 'survey_option_id' => $survey->options->first()->id]);
    SurveyTextAnswer::factory()->create(['survey_id' => $survey->id]);
    SurveyReaction::factory()->create(['retro_id' => $survey->retro_id, 'survey_id' => $survey->id]);
    SurveyComment::factory()->create(['retro_id' => $survey->retro_id, 'survey_id' => $survey->id]);

    $survey->retro->delete();

    expect(Survey::count())->toBe(0)
        ->and(SurveyOption::count())->toBe(0)
        ->and(SurveyResponse::count())->toBe(0)
        ->and(SurveyTextAnswer::count())->toBe(0)
        ->and(SurveyReaction::count())->toBe(0)
        ->and(SurveyComment::count())->toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/SurveyModelTest.php`
Expected: FAIL with `Class "App\Enums\SurveyKind" not found`.

- [ ] **Step 3: Create the migrations**

`database/migrations/2026_10_01_120000_create_surveys_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('surveys', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('created_by_participant_id')->nullable()->constrained('participants')->nullOnDelete();
            $table->string('kind')->default('single');
            $table->string('question', 200);
            $table->string('description', 500)->nullable();
            $table->unsignedInteger('position');
            $table->boolean('is_closed')->default(false);
            $table->boolean('show_voters')->default(false);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
            $table->index(['retro_id', 'position']);
        });
    }
};
```

`database/migrations/2026_10_01_120100_create_survey_options_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('survey_options', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('survey_id')->constrained()->cascadeOnDelete();
            $table->string('label', 100);
            $table->unsignedInteger('position');
            $table->timestamps();
            $table->index(['survey_id', 'position']);
        });
    }
};
```

`database/migrations/2026_10_01_120200_create_survey_responses_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('survey_responses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('survey_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('survey_option_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['survey_id', 'participant_id', 'survey_option_id']);
        });
    }
};
```

`database/migrations/2026_10_01_120300_create_survey_text_answers_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('survey_text_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('survey_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
            $table->text('content');
            $table->timestamps();
            $table->unique(['survey_id', 'participant_id']);
        });
    }
};
```

`database/migrations/2026_10_01_120400_create_survey_reactions_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('survey_reactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('survey_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
            $table->string('emoji', 64);
            $table->timestamps();
            $table->unique(['survey_id', 'participant_id', 'emoji']);
            $table->index('retro_id');
        });
    }
};
```

`database/migrations/2026_10_01_120500_create_survey_comments_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('survey_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('survey_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
            $table->uuid('parent_comment_id')->nullable();
            $table->text('content')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
            $table->index(['survey_id', 'created_at']);
            $table->index('retro_id');
        });

        Schema::table('survey_comments', function (Blueprint $table) {
            $table->foreign('parent_comment_id')->references('id')->on('survey_comments')->cascadeOnDelete();
        });
    }
};
```

- [ ] **Step 4: Create the enum and models**

`app/Enums/SurveyKind.php`:

```php
<?php

namespace App\Enums;

enum SurveyKind: string
{
    case Single = 'single';
    case Multiple = 'multiple';
    case Text = 'text';

    public function isChoice(): bool
    {
        return $this !== self::Text;
    }
}
```

`app/Models/Survey.php`:

```php
<?php

namespace App\Models;

use App\Enums\SurveyKind;
use Database\Factories\SurveyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection as SupportCollection;

/**
 * @property string $id
 * @property string $retro_id
 * @property string|null $created_by_participant_id
 * @property SurveyKind $kind
 * @property string $question
 * @property string|null $description
 * @property int $position
 * @property bool $is_closed
 * @property bool $show_voters
 * @property int $version
 * @property-read Retro $retro
 * @property-read Collection<int, SurveyOption> $options
 * @property-read Collection<int, SurveyResponse> $responses
 * @property-read Collection<int, SurveyTextAnswer> $textAnswers
 * @property-read Collection<int, SurveyReaction> $reactions
 * @property-read Collection<int, SurveyComment> $comments
 */
#[Fillable(['created_by_participant_id', 'kind', 'question', 'description', 'position', 'is_closed', 'show_voters', 'version'])]
class Survey extends Model
{
    /** @use HasFactory<SurveyFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'created_by_participant_id');
    }

    /** @return HasMany<SurveyOption, $this> */
    public function options(): HasMany
    {
        return $this->hasMany(SurveyOption::class)->orderBy('position');
    }

    /** @return HasMany<SurveyResponse, $this> */
    public function responses(): HasMany
    {
        return $this->hasMany(SurveyResponse::class);
    }

    /** @return HasMany<SurveyTextAnswer, $this> */
    public function textAnswers(): HasMany
    {
        return $this->hasMany(SurveyTextAnswer::class);
    }

    /** @return HasMany<SurveyReaction, $this> */
    public function reactions(): HasMany
    {
        return $this->hasMany(SurveyReaction::class)->oldest();
    }

    /** @return HasMany<SurveyComment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(SurveyComment::class)->oldest();
    }

    public function responseCount(): int
    {
        if ($this->kind === SurveyKind::Text) {
            return $this->textAnswers()->count();
        }

        return $this->responses()->distinct()->count('participant_id');
    }

    public function commentCount(): int
    {
        return $this->comments()->whereNull('deleted_at')->count();
    }

    /**
     * @return SupportCollection<int, string>
     */
    public function answeredParticipantIds(): SupportCollection
    {
        return $this->responses()->pluck('participant_id')
            ->merge($this->textAnswers()->pluck('participant_id'))
            ->map(fn (mixed $participantId): string => (string) $participantId)
            ->unique()
            ->values();
    }

    public function hasAnswerFrom(Participant $participant): bool
    {
        return $this->responses()->where('participant_id', $participant->id)->exists()
            || $this->textAnswers()->where('participant_id', $participant->id)->exists();
    }

    public function isVisibleTo(Participant $participant): bool
    {
        return $this->is_closed || $this->hasAnswerFrom($participant);
    }

    protected function casts(): array
    {
        return [
            'kind' => SurveyKind::class,
            'position' => 'integer',
            'is_closed' => 'boolean',
            'show_voters' => 'boolean',
            'version' => 'integer',
        ];
    }
}
```

`app/Models/SurveyOption.php`:

```php
<?php

namespace App\Models;

use Database\Factories\SurveyOptionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $survey_id
 * @property string $label
 * @property int $position
 */
#[Fillable(['label', 'position'])]
class SurveyOption extends Model
{
    /** @use HasFactory<SurveyOptionFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Survey, $this> */
    public function survey(): BelongsTo
    {
        return $this->belongsTo(Survey::class);
    }

    /** @return HasMany<SurveyResponse, $this> */
    public function responses(): HasMany
    {
        return $this->hasMany(SurveyResponse::class);
    }

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }
}
```

`app/Models/SurveyResponse.php`:

```php
<?php

namespace App\Models;

use Database\Factories\SurveyResponseFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $survey_id
 * @property string $survey_option_id
 * @property string $participant_id
 */
#[Fillable(['survey_option_id', 'participant_id'])]
class SurveyResponse extends Model
{
    /** @use HasFactory<SurveyResponseFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Survey, $this> */
    public function survey(): BelongsTo
    {
        return $this->belongsTo(Survey::class);
    }
}
```

`app/Models/SurveyTextAnswer.php`:

```php
<?php

namespace App\Models;

use Database\Factories\SurveyTextAnswerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $survey_id
 * @property string $participant_id
 * @property string $content
 */
#[Fillable(['participant_id', 'content'])]
class SurveyTextAnswer extends Model
{
    /** @use HasFactory<SurveyTextAnswerFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Survey, $this> */
    public function survey(): BelongsTo
    {
        return $this->belongsTo(Survey::class);
    }
}
```

`app/Models/SurveyReaction.php`:

```php
<?php

namespace App\Models;

use Database\Factories\SurveyReactionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $survey_id
 * @property string $participant_id
 * @property string $emoji
 * @property-read Participant $participant
 */
#[Fillable(['retro_id', 'participant_id', 'emoji'])]
class SurveyReaction extends Model
{
    /** @use HasFactory<SurveyReactionFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Survey, $this> */
    public function survey(): BelongsTo
    {
        return $this->belongsTo(Survey::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }
}
```

`app/Models/SurveyComment.php`:

```php
<?php

namespace App\Models;

use Database\Factories\SurveyCommentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $survey_id
 * @property string $participant_id
 * @property string|null $parent_comment_id
 * @property string|null $content
 * @property Carbon|null $deleted_at
 * @property Carbon $created_at
 * @property-read Participant $participant
 * @property-read Survey $survey
 */
#[Fillable(['retro_id', 'survey_id', 'participant_id', 'parent_comment_id', 'content', 'deleted_at'])]
class SurveyComment extends Model
{
    /** @use HasFactory<SurveyCommentFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Survey, $this> */
    public function survey(): BelongsTo
    {
        return $this->belongsTo(Survey::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    /** @return HasMany<SurveyComment, $this> */
    public function replies(): HasMany
    {
        return $this->hasMany(SurveyComment::class, 'parent_comment_id')->oldest();
    }

    public function isDeleted(): bool
    {
        return $this->deleted_at !== null;
    }

    public function threadId(): string
    {
        return $this->parent_comment_id ?? $this->id;
    }

    protected function casts(): array
    {
        return ['deleted_at' => 'datetime'];
    }
}
```

In `app/Models/Retro.php`, add after `comments()`:

```php
    /** @return HasMany<Survey, $this> */
    public function surveys(): HasMany
    {
        return $this->hasMany(Survey::class)->orderBy('position');
    }

    /** @return HasMany<SurveyComment, $this> */
    public function surveyComments(): HasMany
    {
        return $this->hasMany(SurveyComment::class);
    }
```

- [ ] **Step 5: Create the factories**

`database/factories/SurveyFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\SurveyKind;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Survey>
 */
class SurveyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'created_by_participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'kind' => SurveyKind::Single,
            'question' => fake()->sentence().'?',
            'position' => 0,
        ];
    }

    public function single(): static
    {
        return $this->state(fn () => ['kind' => SurveyKind::Single]);
    }

    public function multiple(): static
    {
        return $this->state(fn () => ['kind' => SurveyKind::Multiple]);
    }

    public function text(): static
    {
        return $this->state(fn () => ['kind' => SurveyKind::Text]);
    }

    public function closed(): static
    {
        return $this->state(fn () => ['is_closed' => true]);
    }

    /**
     * @param  array<int, string>  $labels
     */
    public function withOptions(array $labels = ['Yes', 'No', 'Maybe']): static
    {
        return $this->afterCreating(function (Survey $survey) use ($labels): void {
            foreach ($labels as $position => $label) {
                $survey->options()->create(['label' => $label, 'position' => $position]);
            }
        });
    }
}
```

`database/factories/SurveyOptionFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Survey;
use App\Models\SurveyOption;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SurveyOption>
 */
class SurveyOptionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'survey_id' => Survey::factory(),
            'label' => fake()->word(),
            'position' => 0,
        ];
    }
}
```

`database/factories/SurveyResponseFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Participant;
use App\Models\Survey;
use App\Models\SurveyOption;
use App\Models\SurveyResponse;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SurveyResponse>
 */
class SurveyResponseFactory extends Factory
{
    public function definition(): array
    {
        return [
            'survey_id' => Survey::factory(),
            'survey_option_id' => fn (array $attributes) => SurveyOption::factory()->create(['survey_id' => $attributes['survey_id']])->id,
            'participant_id' => fn (array $attributes) => Participant::factory()->create([
                'retro_id' => Survey::query()->findOrFail($attributes['survey_id'])->retro_id,
            ])->id,
        ];
    }
}
```

`database/factories/SurveyTextAnswerFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Participant;
use App\Models\Survey;
use App\Models\SurveyTextAnswer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SurveyTextAnswer>
 */
class SurveyTextAnswerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'survey_id' => Survey::factory()->text(),
            'participant_id' => fn (array $attributes) => Participant::factory()->create([
                'retro_id' => Survey::query()->findOrFail($attributes['survey_id'])->retro_id,
            ])->id,
            'content' => fake()->sentence(),
        ];
    }
}
```

`database/factories/SurveyReactionFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyReaction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SurveyReaction>
 */
class SurveyReactionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'survey_id' => fn (array $attributes) => Survey::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'emoji' => '👍',
        ];
    }
}
```

`database/factories/SurveyCommentFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SurveyComment>
 */
class SurveyCommentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'survey_id' => fn (array $attributes) => Survey::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'content' => fake()->sentence(),
        ];
    }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Retros/SurveyModelTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS.

- [ ] **Step 7: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.

```bash
git add app/Enums/SurveyKind.php app/Models database tests/Feature/Retros/SurveyModelTest.php
git commit -m "feat: add survey tables, models and factories"
```

---

### Task 2: Survey presenter with server-side redaction, and surveys in the snapshot

**Files:**
- Create: `app/Actions/Surveys/PresentSurvey.php`
- Modify: `app/Actions/Retros/SummarizeReactions.php`, `app/Actions/Retros/PresentComment.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `tests/Pest.php`
- Test: create `tests/Feature/Retros/SurveyPresentationTest.php`; existing `tests/Feature/Retros/{CardReactionsTest,CardCommentsTest,BoardSnapshotTest}.php` must stay green

**Interfaces:**
- Consumes: Task 1 models.
- Produces:
  - `SummarizeReactions::handle(Collection<int, CardReaction|SurveyReaction> $reactions, Retro $retro, ?Participant $viewer, ?bool $showsNames = null): array` and `forOthers(Collection $reactions, Retro $retro, ?bool $showsNames = null): array` — `$showsNames` defaults to `! $retro->is_anonymous` so card call sites are unchanged.
  - `PresentComment::handle(CardComment|SurveyComment $comment, Retro $retro, ?Participant $viewer): array` — returns `cardId` for card comments and `surveyId` for survey comments (key in the same position); `threads(Collection<int, CardComment|SurveyComment> $comments, …)`.
  - `PresentSurvey::handle(Survey $survey, Retro $retro, Participant $viewer): array` (spec §5.2: `id, kind, question, description, position, isClosed, version, showVoters, responseCount, myOptionIds, myText, resultsVisible, options[{id,label,position,count,voters}], textAnswers, reactions, commentCount, comments`) and `PresentSurvey::many(Retro $retro, Participant $viewer): array` (ordered by position, constant queries). `PresentSurvey::Relations` constant lists the eager loads.
  - Snapshot key `surveys` (array of survey payloads).
  - Test helper `answerSurvey(Survey $survey, Participant $participant, int ...$optionIndexes): void` in `tests/Pest.php`.

- [ ] **Step 1: Add the test helper**

Append to `tests/Pest.php` (add `use App\Models\Survey;` and `use App\Models\SurveyResponse;` to the imports):

```php
function answerSurvey(Survey $survey, Participant $participant, int ...$optionIndexes): void
{
    $options = $survey->options()->get()->values();

    foreach ($optionIndexes as $index) {
        SurveyResponse::factory()->create([
            'survey_id' => $survey->id,
            'survey_option_id' => $options[$index]->id,
            'participant_id' => $participant->id,
        ]);
    }
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/Feature/Retros/SurveyPresentationTest.php`:

```php
<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Actions\Surveys\PresentSurvey;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyReaction;
use App\Models\SurveyTextAnswer;
use Illuminate\Support\Facades\DB;

function presentedSurvey(Survey $survey, Participant $viewer): array
{
    $fresh = $survey->fresh();

    return app(PresentSurvey::class)->handle($fresh, $fresh->retro, $viewer);
}

function surveyAudience(array $retroAttributes = []): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create($retroAttributes);
    [, $viewer] = retroMember($retro);
    [, $other] = retroMember($retro);

    return [$retro, $viewer, $other];
}

it('hides counts and voters until the viewer answers', function () {
    [$retro, $viewer, $other] = surveyAudience();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, 'show_voters' => true]);
    answerSurvey($survey, $other, 0);

    $hidden = presentedSurvey($survey, $viewer);

    expect($hidden)->toMatchArray(['resultsVisible' => false, 'responseCount' => 1, 'myOptionIds' => [], 'myText' => null, 'showVoters' => true])
        ->and(collect($hidden['options'])->pluck('count')->all())->toBe([null, null, null])
        ->and(collect($hidden['options'])->pluck('voters')->all())->toBe([null, null, null])
        ->and(json_encode($hidden))->not->toContain($other->id);

    answerSurvey($survey, $viewer, 1);

    $visible = presentedSurvey($survey, $viewer);

    expect($visible['resultsVisible'])->toBeTrue()
        ->and($visible['myOptionIds'])->toBe([$survey->options[1]->id])
        ->and(collect($visible['options'])->pluck('count')->all())->toBe([1, 1, 0])
        ->and($visible['options'][0]['voters'])->toBe([$other->id])
        ->and($visible['options'][1]['voters'])->toBe([$viewer->id]);
});

it('shows counts to everyone once the survey is closed', function () {
    [$retro, $viewer, $other] = surveyAudience();
    $survey = Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id]);
    answerSurvey($survey, $other, 2);

    $payload = presentedSurvey($survey, $viewer);

    expect($payload['resultsVisible'])->toBeTrue()
        ->and($payload['isClosed'])->toBeTrue()
        ->and(collect($payload['options'])->pluck('count')->all())->toBe([0, 0, 1]);
});

it('never links a participant to an option when show who answered is off', function () {
    [$retro, $viewer, $other] = surveyAudience();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    answerSurvey($survey, $other, 0);
    answerSurvey($survey, $viewer, 0);

    $payload = presentedSurvey($survey, $viewer);

    expect($payload['showVoters'])->toBeFalse()
        ->and(collect($payload['options'])->pluck('voters')->all())->toBe([null, null, null])
        ->and(json_encode($payload))->not->toContain($other->id);
});

it('never sends voters, text authors or reaction names on anonymous retros', function () {
    [$retro, $viewer, $other] = surveyAudience(['is_anonymous' => true]);
    $choice = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, 'show_voters' => true]);
    $text = Survey::factory()->text()->create(['retro_id' => $retro->id, 'show_voters' => true, 'position' => 1]);
    answerSurvey($choice, $other, 0);
    answerSurvey($choice, $viewer, 0);
    SurveyTextAnswer::factory()->create(['survey_id' => $text->id, 'participant_id' => $other->id, 'content' => 'Theirs']);
    SurveyTextAnswer::factory()->create(['survey_id' => $text->id, 'participant_id' => $viewer->id, 'content' => 'Mine']);
    SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $choice->id, 'participant_id' => $other->id]);

    $choicePayload = presentedSurvey($choice, $viewer);
    $textPayload = presentedSurvey($text, $viewer);

    expect($choicePayload['showVoters'])->toBeFalse()
        ->and($choicePayload['options'][0]['voters'])->toBeNull()
        ->and($choicePayload['reactions'][0]['names'])->toBe([])
        ->and(collect($textPayload['textAnswers'])->pluck('authorId')->all())->toBe([null, null])
        ->and(json_encode([$choicePayload, $textPayload]))->not->toContain($other->id);
});

it('counts multiple choice answers per option and each respondent once', function () {
    [$retro, $viewer, $other] = surveyAudience();
    $survey = Survey::factory()->multiple()->withOptions()->create(['retro_id' => $retro->id]);
    answerSurvey($survey, $other, 0, 1);
    answerSurvey($survey, $viewer, 1);

    $payload = presentedSurvey($survey, $viewer);

    expect($payload['kind'])->toBe('multiple')
        ->and($payload['responseCount'])->toBe(2)
        ->and($payload['myOptionIds'])->toBe([$survey->options[1]->id])
        ->and(collect($payload['options'])->pluck('count')->all())->toBe([1, 2, 0])
        ->and($payload['textAnswers'])->toBeNull();
});

it('orders free-text answers by text and names authors only when allowed', function (bool $showVoters, bool $isAnonymous, bool $namesAuthors) {
    [$retro, $viewer, $other] = surveyAudience(['is_anonymous' => $isAnonymous]);
    [, $third] = retroMember($retro);
    $survey = Survey::factory()->text()->create(['retro_id' => $retro->id, 'show_voters' => $showVoters]);
    SurveyTextAnswer::factory()->create(['survey_id' => $survey->id, 'participant_id' => $third->id, 'content' => 'cherry']);
    SurveyTextAnswer::factory()->create(['survey_id' => $survey->id, 'participant_id' => $other->id, 'content' => 'banana']);

    expect(presentedSurvey($survey, $viewer)['textAnswers'])->toBeNull();

    SurveyTextAnswer::factory()->create(['survey_id' => $survey->id, 'participant_id' => $viewer->id, 'content' => 'Apple']);

    $payload = presentedSurvey($survey, $viewer);

    expect(collect($payload['textAnswers'])->pluck('text')->all())->toBe(['Apple', 'banana', 'cherry'])
        ->and(collect($payload['textAnswers'])->pluck('isMine')->all())->toBe([true, false, false])
        ->and($payload['myText'])->toBe('Apple')
        ->and($payload['responseCount'])->toBe(3)
        ->and($payload['textAnswers'][1]['authorId'])->toBe($namesAuthors ? $other->id : null);
})->with([
    'hidden by default' => [false, false, false],
    'shown by the facilitator' => [true, false, true],
    'never on anonymous retros' => [true, true, false],
]);

it('keeps reactions and comments for viewers who can see the results', function () {
    [$retro, $viewer, $other] = surveyAudience();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    answerSurvey($survey, $other, 0);
    SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $other->id, 'emoji' => '🎉']);
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $other->id, 'content' => 'Good one']);

    $hidden = presentedSurvey($survey, $viewer);

    expect($hidden)->toMatchArray(['reactions' => [], 'comments' => [], 'commentCount' => 1])
        ->and(json_encode($hidden))->not->toContain('Good one');

    answerSurvey($survey, $viewer, 1);

    $visible = presentedSurvey($survey, $viewer);

    expect($visible['reactions'])->toBe([['emoji' => '🎉', 'count' => 1, 'mine' => false, 'names' => []]])
        ->and($visible['comments'][0])->toMatchArray([
            'surveyId' => $survey->id,
            'content' => 'Good one',
            'author' => ['id' => $other->id, 'name' => $other->displayName()],
        ]);
});

it('names reactions only when show who answered is on', function () {
    [$retro, $viewer, $other] = surveyAudience();
    $survey = Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id, 'show_voters' => true]);
    SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $other->id]);

    expect(presentedSurvey($survey, $viewer)['reactions'][0]['names'])->toBe([$other->displayName()]);
});

it('hides comment authors on anonymous retros', function () {
    [$retro, $viewer, $other] = surveyAudience(['is_anonymous' => true]);
    $survey = Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id]);
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $other->id]);

    $payload = presentedSurvey($survey, $viewer);

    expect($payload['comments'][0]['author'])->toBeNull()
        ->and(json_encode($payload))->not->toContain($other->id);
});

it('adds surveys to the snapshot in order with a constant number of queries', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $viewer] = retroMember($retro);

    $seed = function (int $count) use ($retro, $viewer): void {
        foreach (range(1, $count) as $index) {
            $position = (int) $retro->surveys()->max('position') + 1;
            $choice = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, 'position' => $position]);
            $text = Survey::factory()->text()->create(['retro_id' => $retro->id, 'position' => $position + 1]);
            answerSurvey($choice, $viewer, 0);
            SurveyTextAnswer::factory()->create(['survey_id' => $text->id, 'participant_id' => $viewer->id]);
            SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $choice->id]);
            $thread = SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $choice->id]);
            SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $choice->id, 'parent_comment_id' => $thread->id]);
        }
    };

    $countQueries = function () use ($retro, $viewer): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(1);
    $small = $countQueries();

    $seed(4);

    $positions = collect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['surveys'])->pluck('position')->all();

    expect($countQueries())->toBe($small)
        ->and($positions)->toBe(collect($positions)->sort()->values()->all())
        ->and($positions)->toHaveCount(10);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/SurveyPresentationTest.php`
Expected: FAIL with `Class "App\Actions\Surveys\PresentSurvey" not found`.

- [ ] **Step 4: Generalise `SummarizeReactions`**

Replace `app/Actions/Retros/SummarizeReactions.php` with:

```php
<?php

namespace App\Actions\Retros;

use App\Models\CardReaction;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SurveyReaction;
use Illuminate\Support\Collection;

class SummarizeReactions
{
    /**
     * Names are shown on named retros unless the caller decides otherwise
     * (surveys only name reactions when "Show who answered" is on).
     *
     * @param  Collection<int, CardReaction|SurveyReaction>  $reactions
     * @param  Retro  $retro
     * @param  ?Participant  $viewer
     * @param  ?bool  $showsNames
     * @return array<int, array{
     *     emoji: string,
     *     count: int,
     *     mine: bool,
     *     names: array<int, string>
     * }>
     */
    public function handle(Collection $reactions, Retro $retro, ?Participant $viewer, ?bool $showsNames = null): array
    {
        $showsNames ??= ! $retro->is_anonymous;

        return $reactions
            ->groupBy('emoji')
            ->map(fn (Collection $group, string $emoji) => [
                'emoji' => $emoji,
                'count' => $group->count(),
                'mine' => $viewer !== null && $group->contains('participant_id', $viewer->id),
                'names' => $showsNames
                    ? $group->map(fn (CardReaction|SurveyReaction $reaction) => $reaction->participant->displayName())->values()->all()
                    : [],
            ])
            ->values()
            ->sortByDesc('count')
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, CardReaction|SurveyReaction>  $reactions
     * @param  Retro  $retro
     * @param  ?bool  $showsNames
     * @return array<int, array{
     *     emoji: string,
     *     count: int,
     *     names: array<int, string>
     * }>
     */
    public function forOthers(Collection $reactions, Retro $retro, ?bool $showsNames = null): array
    {
        return array_map(
            fn (array $summary) => ['emoji' => $summary['emoji'], 'count' => $summary['count'], 'names' => $summary['names']],
            $this->handle($reactions, $retro, null, $showsNames),
        );
    }
}
```

- [ ] **Step 5: Generalise `PresentComment`**

Replace `app/Actions/Retros/PresentComment.php` with:

```php
<?php

namespace App\Actions\Retros;

use App\Models\CardComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SurveyComment;
use Illuminate\Support\Collection;

class PresentComment
{
    /**
     * @return array{
     *     id: string,
     *     cardId?: string,
     *     surveyId?: string,
     *     parentCommentId: ?string,
     *     isMine: bool,
     *     deleted: bool,
     *     content: ?string,
     *     author: ?array{id: string, name: string},
     *     createdAt: string
     * }
     */
    public function handle(CardComment|SurveyComment $comment, Retro $retro, ?Participant $viewer): array
    {
        $isMine = $viewer !== null && $comment->participant_id === $viewer->id;
        $showsAuthor = ! $comment->isDeleted() && ($isMine || ! $retro->is_anonymous);
        $subject = $comment instanceof SurveyComment
            ? ['surveyId' => $comment->survey_id]
            : ['cardId' => $comment->card_id];

        return [
            'id' => $comment->id,
            ...$subject,
            'parentCommentId' => $comment->parent_comment_id,
            'isMine' => $isMine,
            'deleted' => $comment->isDeleted(),
            'content' => $comment->isDeleted() ? null : $comment->content,
            'author' => $showsAuthor
                ? ['id' => $comment->participant_id, 'name' => $comment->participant->displayName()]
                : null,
            'createdAt' => $comment->created_at->toIso8601String(),
        ];
    }

    /**
     * @param  Collection<int, CardComment|SurveyComment>  $comments  every comment of one card or survey, oldest first
     * @param  Retro  $retro
     * @param  ?Participant  $viewer
     * @return array<int, array<string, mixed>>
     */
    public function threads(Collection $comments, Retro $retro, ?Participant $viewer): array
    {
        $repliesByParent = $comments->whereNotNull('parent_comment_id')->groupBy('parent_comment_id');

        return $comments
            ->whereNull('parent_comment_id')
            ->map(fn (CardComment|SurveyComment $comment) => [
                ...$this->handle($comment, $retro, $viewer),
                'replies' => $repliesByParent->get($comment->id, collect())
                    ->map(fn (CardComment|SurveyComment $reply) => $this->handle($reply, $retro, $viewer))
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }
}
```

- [ ] **Step 6: Create `PresentSurvey`**

`app/Actions/Surveys/PresentSurvey.php`:

```php
<?php

namespace App\Actions\Surveys;

use App\Actions\Retros\PresentComment;
use App\Actions\Retros\SummarizeReactions;
use App\Enums\SurveyKind;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyOption;
use App\Models\SurveyTextAnswer;

class PresentSurvey
{
    public const Relations = [
        'options',
        'responses',
        'textAnswers',
        'reactions.participant.user',
        'comments.participant.user',
    ];

    public function __construct(
        private SummarizeReactions $summarizeReactions,
        private PresentComment $presentComment,
    ) {}

    /**
     * @return array<int, array<string, mixed>>
     */
    public function many(Retro $retro, Participant $viewer): array
    {
        return $retro->surveys()
            ->with(self::Relations)
            ->get()
            ->map(fn (Survey $survey) => $this->handle($survey, $retro, $viewer))
            ->values()
            ->all();
    }

    /**
     * Counts, voters, text answers, reactions and comments are only sent to
     * viewers who answered or once the survey is closed, so the discussion
     * cannot steer answers or reveal results early.
     *
     * @return array{
     *     id: string,
     *     kind: string,
     *     question: string,
     *     description: ?string,
     *     position: int,
     *     isClosed: bool,
     *     version: int,
     *     showVoters: bool,
     *     responseCount: int,
     *     myOptionIds: array<int, string>,
     *     myText: ?string,
     *     resultsVisible: bool,
     *     options: array<int, array{id: string, label: string, position: int, count: ?int, voters: ?array<int, string>}>,
     *     textAnswers: ?array<int, array{id: string, text: string, authorId: ?string, isMine: bool}>,
     *     reactions: array<int, array{emoji: string, count: int, mine: bool, names: array<int, string>}>,
     *     commentCount: int,
     *     comments: array<int, array<string, mixed>>
     * }
     */
    public function handle(Survey $survey, Retro $retro, Participant $viewer): array
    {
        $survey->loadMissing(self::Relations);

        $myOptionIds = $survey->responses->where('participant_id', $viewer->id)->pluck('survey_option_id')->values()->all();
        $myText = $survey->textAnswers->firstWhere('participant_id', $viewer->id)?->content;
        $resultsVisible = $survey->is_closed || $myOptionIds !== [] || $myText !== null;
        $showsNames = $survey->show_voters && ! $retro->is_anonymous;

        return [
            'id' => $survey->id,
            'kind' => $survey->kind->value,
            'question' => $survey->question,
            'description' => $survey->description,
            'position' => $survey->position,
            'isClosed' => $survey->is_closed,
            'version' => $survey->version,
            'showVoters' => $showsNames,
            'responseCount' => $this->responseCount($survey),
            'myOptionIds' => $myOptionIds,
            'myText' => $myText,
            'resultsVisible' => $resultsVisible,
            'options' => $survey->options->map(fn (SurveyOption $option) => [
                'id' => $option->id,
                'label' => $option->label,
                'position' => $option->position,
                'count' => $resultsVisible ? $survey->responses->where('survey_option_id', $option->id)->count() : null,
                'voters' => $resultsVisible && $showsNames
                    ? $survey->responses->where('survey_option_id', $option->id)->pluck('participant_id')->values()->all()
                    : null,
            ])->values()->all(),
            'textAnswers' => $resultsVisible && $survey->kind === SurveyKind::Text
                ? $this->textAnswers($survey, $viewer, $showsNames)
                : null,
            'reactions' => $resultsVisible
                ? $this->summarizeReactions->handle($survey->reactions, $retro, $viewer, $showsNames)
                : [],
            'commentCount' => $survey->comments->reject(fn (SurveyComment $comment) => $comment->isDeleted())->count(),
            'comments' => $resultsVisible ? $this->presentComment->threads($survey->comments, $retro, $viewer) : [],
        ];
    }

    private function responseCount(Survey $survey): int
    {
        if ($survey->kind === SurveyKind::Text) {
            return $survey->textAnswers->count();
        }

        return $survey->responses->pluck('participant_id')->unique()->count();
    }

    /**
     * Ordered by text so the order reveals neither when nor by whom an
     * answer was written.
     *
     * @return array<int, array{id: string, text: string, authorId: ?string, isMine: bool}>
     */
    private function textAnswers(Survey $survey, Participant $viewer, bool $showsNames): array
    {
        return $survey->textAnswers
            ->sort(fn (SurveyTextAnswer $first, SurveyTextAnswer $second) => [mb_strtolower($first->content), $first->id]
                <=> [mb_strtolower($second->content), $second->id])
            ->map(fn (SurveyTextAnswer $answer) => [
                'id' => $answer->id,
                'text' => $answer->content,
                'authorId' => $showsNames ? $answer->participant_id : null,
                'isMine' => $answer->participant_id === $viewer->id,
            ])
            ->values()
            ->all();
    }
}
```

- [ ] **Step 7: Add surveys to the snapshot**

In `app/Actions/Retros/BuildBoardSnapshot.php`, add `use App\Actions\Surveys\PresentSurvey;`, add the constructor dependency (keep the existing ones, including any added by Plans 8a and 8b):

```php
        private PresentSurvey $presentSurvey,
```

and, in the returned array right after the `'actionItems' => …` entry:

```php
            'surveys' => $this->presentSurvey->many($retro, $viewer),
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/SurveyPresentationTest.php tests/Feature/Retros/CardReactionsTest.php tests/Feature/Retros/CardCommentsTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.

```bash
git add app/Actions tests/Pest.php tests/Feature/Retros/SurveyPresentationTest.php
git commit -m "feat: present surveys per viewer with results hidden until answered"
```

---
### Task 3: Create, edit, show and delete surveys (facilitator), with "Show who answered"

**Files:**
- Create: `app/Actions/Surveys/SurveyGuard.php`, `app/Http/Controllers/Retros/SurveysController.php`, `app/Events/Retros/SurveyChanged.php`, `app/Events/Retros/SurveyDeleted.php`
- Modify: `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/Retros/SurveysTest.php`

**Interfaces:**
- Consumes: `PresentSurvey::handle()` (Task 2), `RetroGuard::{facilitator,phase,unlocked}`, `RetroPhase::isOpen()` (Plan 8a).
- Produces:
  - `SurveyGuard::activePhase(Retro $retro): void` (403 outside `Writing`–`Discussing`), `SurveyGuard::notCompleted(Retro $retro): void` (403 in `Completed`), `SurveyGuard::open(Survey $survey): void` (422 "This survey is closed."), `SurveyGuard::unanswered(Survey $survey): void` (422 "This survey already has answers."), `SurveyGuard::namesAllowed(Retro $retro, bool $showVoters): void` (422 "Names are never shown on anonymous retros."), `SurveyGuard::resultsVisible(Survey $survey, Participant $participant): void` (403 "Answer the survey to join the discussion.").
  - `SurveyChanged::for(Survey $survey): SurveyChanged` → `survey.changed {surveyId, version, responseCount}`; `SurveyDeleted` → `survey.deleted {surveyId}`.
  - Routes (all under `retros/{retro}`): `retros.surveys.store` POST `surveys`; `retros.surveys.show` GET `surveys/{survey}`; `retros.surveys.update` PATCH `surveys/{survey}`; `retros.surveys.destroy` DELETE `surveys/{survey}`. Responses `{survey: SurveyPayload}` (201 on create), 204 on delete.
  - Body: `{kind?: 'single'|'multiple'|'text' (default single), question, description?, options: string[], show_voters?: bool}`. A `PATCH` whose only key is `show_voters` toggles the switch (any open phase, allowed while locked, allowed with answers); any other `PATCH` replaces kind, question, description and options (refused once answered) and requires the full body.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/SurveysTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\SurveyChanged;
use App\Events\Retros\SurveyDeleted;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyReaction;
use App\Models\SurveyResponse;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function surveyingRetro(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $facilitator] = retroFacilitator($retro);

    return [$retro, $user, $facilitator];
}

it('lets the facilitator create a single choice survey', function () {
    [$retro, $user, $facilitator] = surveyingRetro();

    $response = $this->actingAs($user)->postJson(route('retros.surveys.store', $retro), [
        'question' => 'How was the sprint?',
        'description' => 'Be honest',
        'options' => ['Great', 'Fine', 'Rough'],
    ])->assertCreated()
        ->assertJsonPath('survey.kind', 'single')
        ->assertJsonPath('survey.question', 'How was the sprint?')
        ->assertJsonPath('survey.description', 'Be honest')
        ->assertJsonPath('survey.showVoters', false)
        ->assertJsonPath('survey.resultsVisible', false)
        ->assertJsonPath('survey.options.2.label', 'Rough');

    $survey = Survey::findOrFail($response->json('survey.id'));

    expect($survey->created_by_participant_id)->toBe($facilitator->id)
        ->and($survey->position)->toBe(0);
    Event::assertDispatched(SurveyChanged::class, fn (SurveyChanged $event) => $event->broadcastAs() === 'survey.changed'
        && $event->broadcastWith() === ['surveyId' => $survey->id, 'version' => 1, 'responseCount' => 0]);
});

it('creates multiple choice and free-text surveys', function () {
    [$retro, $user] = surveyingRetro(RetroPhase::Voting);

    $this->actingAs($user)->postJson(route('retros.surveys.store', $retro), ['kind' => 'multiple', 'question' => 'Which?', 'options' => ['A', 'B']])
        ->assertCreated()
        ->assertJsonPath('survey.kind', 'multiple');
    $this->actingAs($user)->postJson(route('retros.surveys.store', $retro), ['kind' => 'text', 'question' => 'Why?', 'options' => []])
        ->assertCreated()
        ->assertJsonPath('survey.kind', 'text')
        ->assertJsonPath('survey.options', [])
        ->assertJsonPath('survey.position', 1);
});

it('validates questions and options by kind', function (array $body, string $field) {
    [$retro, $user] = surveyingRetro();

    $this->actingAs($user)->postJson(route('retros.surveys.store', $retro), $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no question' => [['question' => '', 'options' => ['A', 'B']], 'question'],
    'question too long' => [['question' => str_repeat('a', 201), 'options' => ['A', 'B']], 'question'],
    'description too long' => [['question' => 'Q', 'description' => str_repeat('a', 501), 'options' => ['A', 'B']], 'description'],
    'one option' => [['question' => 'Q', 'options' => ['A']], 'options'],
    'eleven options' => [['question' => 'Q', 'options' => array_map(fn (int $i) => "Option {$i}", range(1, 11))], 'options'],
    'empty option' => [['question' => 'Q', 'options' => ['A', '']], 'options.1'],
    'option too long' => [['question' => 'Q', 'options' => ['A', str_repeat('b', 101)]], 'options.1'],
    'text with options' => [['kind' => 'text', 'question' => 'Q', 'options' => ['A', 'B']], 'options'],
    'unknown kind' => [['kind' => 'ranking', 'question' => 'Q', 'options' => ['A', 'B']], 'kind'],
]);

it('refuses an eleventh survey', function () {
    [$retro, $user] = surveyingRetro();
    Survey::factory()->count(10)->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->postJson(route('retros.surveys.store', $retro), ['question' => 'Q', 'options' => ['A', 'B']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['survey' => 'A retrospective can have at most 10 surveys.']);
});

it('keeps survey management to the facilitator in the board phases', function (RetroPhase $phase, array $attributes, bool $asFacilitator, int $status) {
    [$retro, $user] = surveyingRetro($phase, $attributes);
    [$member] = retroMember($retro);

    $this->actingAs($asFacilitator ? $user : $member)
        ->postJson(route('retros.surveys.store', $retro), ['question' => 'Q', 'options' => ['A', 'B']])
        ->assertStatus($status);
})->with([
    'member' => [RetroPhase::Writing, [], false, 403],
    'health check' => [RetroPhase::HealthCheck, [], true, 403],
    'icebreaker' => [RetroPhase::Icebreaker, [], true, 403],
    'completed' => [RetroPhase::Completed, [], true, 403],
    'locked' => [RetroPhase::Discussing, ['is_locked' => true], true, 423],
]);

it('refuses show who answered on anonymous retros', function () {
    [$retro, $user] = surveyingRetro(RetroPhase::Writing, ['is_anonymous' => true]);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->postJson(route('retros.surveys.store', $retro), ['question' => 'Q', 'options' => ['A', 'B'], 'show_voters' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['show_voters' => 'Names are never shown on anonymous retros.']);
    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), ['show_voters' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['show_voters' => 'Names are never shown on anonymous retros.']);
    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), ['question' => 'Q', 'options' => ['A', 'B'], 'show_voters' => true])
        ->assertUnprocessable();

    expect($survey->fresh()->show_voters)->toBeFalse();
});

it('edits an unanswered survey and replaces its options', function () {
    [$retro, $user] = surveyingRetro();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), [
        'kind' => 'multiple',
        'question' => 'Which ones?',
        'options' => ['Red', 'Blue'],
    ])->assertOk()
        ->assertJsonPath('survey.kind', 'multiple')
        ->assertJsonPath('survey.version', 2)
        ->assertJsonPath('survey.options.*.label', ['Red', 'Blue']);

    Event::assertDispatched(SurveyChanged::class, fn (SurveyChanged $event) => $event->version === 2);
});

it('refuses to edit a survey once it has answers', function (string $kind) {
    [$retro, $user] = surveyingRetro();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    [, $voter] = retroMember($retro);
    answerSurvey($survey, $voter, 0);

    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), [
        'kind' => $kind,
        'question' => 'Changed',
        'options' => $kind === 'text' ? [] : ['A', 'B'],
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['survey' => 'This survey already has answers.']);

    expect($survey->fresh()->question)->not->toBe('Changed');
})->with(['same kind' => 'single', 'kind change' => 'text']);

it('toggles show who answered on an answered survey, even while locked', function () {
    [$retro, $user] = surveyingRetro(RetroPhase::Voting, ['is_locked' => true]);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    [, $voter] = retroMember($retro);
    answerSurvey($survey, $voter, 0);

    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), ['show_voters' => true])
        ->assertOk()
        ->assertJsonPath('survey.showVoters', true)
        ->assertJsonPath('survey.version', 2);

    Event::assertDispatched(SurveyChanged::class, fn (SurveyChanged $event) => $event->version === 2
        && ! str_contains(json_encode($event->broadcastWith()), $voter->id));
});

it('refuses show who answered changes from others and once completed', function () {
    [$retro, $user] = surveyingRetro(RetroPhase::Discussing);
    [$member] = retroMember($retro);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($member)->patchJson(route('retros.surveys.update', [$retro, $survey]), ['show_voters' => true])->assertForbidden();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($user)->patchJson(route('retros.surveys.update', [$retro, $survey]), ['show_voters' => true])->assertForbidden();
});

it('deletes a survey with its answers, reactions and comments', function () {
    [$retro, $user] = surveyingRetro(RetroPhase::Grouping);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    [, $voter] = retroMember($retro);
    answerSurvey($survey, $voter, 0);
    SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id]);
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id]);

    $this->actingAs($user)->deleteJson(route('retros.surveys.destroy', [$retro, $survey]))->assertNoContent();

    expect(Survey::count())->toBe(0)
        ->and(SurveyResponse::count())->toBe(0)
        ->and(SurveyReaction::count())->toBe(0)
        ->and(SurveyComment::count())->toBe(0);
    Event::assertDispatched(SurveyDeleted::class, fn (SurveyDeleted $event) => $event->broadcastWith() === ['surveyId' => $survey->id]);
});

it('shows a survey to any participant, guests included', function () {
    [$retro] = surveyingRetro(RetroPhase::Grouping, ['guest_access_enabled' => true]);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('retros.surveys.show', [$retro, $survey]))
        ->assertOk()
        ->assertJsonPath('survey.id', $survey->id)
        ->assertJsonPath('survey.options.0.count', null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/SurveysTest.php`
Expected: FAIL with `Route [retros.surveys.store] not defined.`

- [ ] **Step 3: Create the guard**

`app/Actions/Surveys/SurveyGuard.php`:

```php
<?php

namespace App\Actions\Surveys;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

class SurveyGuard
{
    public static function activePhase(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing);
    }

    public static function notCompleted(Retro $retro): void
    {
        if ($retro->phase->isOpen()) {
            return;
        }

        throw new AuthorizationException(__('This action is not available in the current phase.'));
    }

    public static function open(Survey $survey): void
    {
        if (! $survey->is_closed) {
            return;
        }

        throw ValidationException::withMessages(['survey' => __('This survey is closed.')]);
    }

    public static function unanswered(Survey $survey): void
    {
        if (! $survey->responses()->exists() && ! $survey->textAnswers()->exists()) {
            return;
        }

        throw ValidationException::withMessages(['survey' => __('This survey already has answers.')]);
    }

    public static function namesAllowed(Retro $retro, bool $showVoters): void
    {
        if (! $showVoters || ! $retro->is_anonymous) {
            return;
        }

        throw ValidationException::withMessages(['show_voters' => __('Names are never shown on anonymous retros.')]);
    }

    public static function resultsVisible(Survey $survey, Participant $participant): void
    {
        if ($survey->isVisibleTo($participant)) {
            return;
        }

        throw new AuthorizationException(__('Answer the survey to join the discussion.'));
    }
}
```

- [ ] **Step 4: Create the events**

`app/Events/Retros/SurveyChanged.php`:

```php
<?php

namespace App\Events\Retros;

use App\Models\Survey;

class SurveyChanged extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $surveyId, public int $version, public int $responseCount)
    {
        parent::__construct($retroId);
    }

    public static function for(Survey $survey): self
    {
        return new self($survey->retro_id, $survey->id, $survey->version, $survey->responseCount());
    }

    public function broadcastAs(): string
    {
        return 'survey.changed';
    }

    public function broadcastWith(): array
    {
        return ['surveyId' => $this->surveyId, 'version' => $this->version, 'responseCount' => $this->responseCount];
    }
}
```

`app/Events/Retros/SurveyDeleted.php`:

```php
<?php

namespace App\Events\Retros;

class SurveyDeleted extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $surveyId)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'survey.deleted';
    }

    public function broadcastWith(): array
    {
        return ['surveyId' => $this->surveyId];
    }
}
```

- [ ] **Step 5: Create the controller**

`app/Http/Controllers/Retros/SurveysController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Surveys\PresentSurvey;
use App\Actions\Surveys\SurveyGuard;
use App\Enums\SurveyKind;
use App\Events\Retros\SurveyChanged;
use App\Events\Retros\SurveyDeleted;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SurveysController extends Controller
{
    private const MaxSurveys = 10;

    private const MinOptions = 2;

    private const MaxOptions = 10;

    public function __construct(private PresentSurvey $presentSurvey) {}

    public function show(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        return response()->json(['survey' => $this->presentSurvey->handle($survey, $retro, Participant::current($request))]);
    }

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        $this->authorizeEditing($retro, $participant);

        $validated = $this->validateSurvey($request, $retro);

        [$survey, $presentingRetro] = DB::transaction(function () use ($retro, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->authorizeEditing($locked, $participant);
            SurveyGuard::namesAllowed($locked, $validated['show_voters']);

            if ($locked->surveys()->count() >= self::MaxSurveys) {
                throw ValidationException::withMessages(['survey' => __('A retrospective can have at most 10 surveys.')]);
            }

            $lastPosition = $locked->surveys()->max('position');

            $survey = $locked->surveys()->create([
                'created_by_participant_id' => $participant->id,
                'kind' => $validated['kind'],
                'question' => $validated['question'],
                'description' => $validated['description'],
                'show_voters' => $validated['show_voters'],
                'position' => $lastPosition === null ? 0 : $lastPosition + 1,
            ]);

            $this->replaceOptions($survey, $validated['options']);

            SurveyChanged::for($survey)->sendToOthers();

            return [$survey, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($survey, $presentingRetro, $participant)], 201);
    }

    public function update(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        $participant = Participant::current($request);

        if ($request->keys() === ['show_voters']) {
            return $this->updateVoterVisibility($request, $retro, $survey, $participant);
        }

        $this->authorizeEditing($retro, $participant);

        $validated = $this->validateSurvey($request, $retro);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $survey, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->authorizeEditing($locked, $participant);
            SurveyGuard::namesAllowed($locked, $validated['show_voters']);

            $fresh = $locked->surveys()->whereKey($survey->id)->firstOrFail();

            SurveyGuard::unanswered($fresh);

            $fresh->fill([
                'kind' => $validated['kind'],
                'question' => $validated['question'],
                'description' => $validated['description'],
                'show_voters' => $validated['show_voters'],
            ]);
            $fresh->version++;
            $fresh->save();

            $this->replaceOptions($fresh, $validated['options']);

            SurveyChanged::for($fresh)->sendToOthers();

            return [$fresh, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($fresh, $presentingRetro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, Survey $survey): Response
    {
        $participant = Participant::current($request);

        $this->authorizeEditing($retro, $participant);

        DB::transaction(function () use ($retro, $survey, $participant): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->authorizeEditing($locked, $participant);

            $fresh = $locked->surveys()->whereKey($survey->id)->firstOrFail();

            $fresh->delete();

            (new SurveyDeleted($locked->id, $fresh->id))->sendToOthers();
        });

        return response()->noContent();
    }

    private function updateVoterVisibility(Request $request, Retro $retro, Survey $survey, Participant $participant): JsonResponse
    {
        RetroGuard::facilitator($retro, $participant);
        SurveyGuard::notCompleted($retro);

        $showVoters = (bool) $request->validate(['show_voters' => ['required', 'boolean']])['show_voters'];

        SurveyGuard::namesAllowed($retro, $showVoters);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $survey, $participant, $showVoters): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            SurveyGuard::notCompleted($locked);
            SurveyGuard::namesAllowed($locked, $showVoters);

            $fresh = $locked->surveys()->whereKey($survey->id)->firstOrFail();

            if ($fresh->show_voters !== $showVoters) {
                $fresh->show_voters = $showVoters;
                $fresh->version++;
                $fresh->save();

                SurveyChanged::for($fresh)->sendToOthers();
            }

            return [$fresh, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($fresh, $presentingRetro, $participant)]);
    }

    private function authorizeEditing(Retro $retro, Participant $participant): void
    {
        RetroGuard::facilitator($retro, $participant);
        SurveyGuard::activePhase($retro);
        RetroGuard::unlocked($retro);
    }

    /**
     * @return array{
     *     kind: SurveyKind,
     *     question: string,
     *     description: ?string,
     *     options: array<int, string>,
     *     show_voters: bool
     * }
     */
    private function validateSurvey(Request $request, Retro $retro): array
    {
        $validated = $request->validate([
            'kind' => ['sometimes', Rule::enum(SurveyKind::class)],
            'question' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:500'],
            'options' => ['sometimes', 'array'],
            'options.*' => ['required', 'string', 'max:100'],
            'show_voters' => ['sometimes', 'boolean'],
        ]);

        $kind = SurveyKind::from($validated['kind'] ?? SurveyKind::Single->value);
        $options = array_values($validated['options'] ?? []);

        $this->ensureOptionsMatch($kind, $options);

        $showVoters = (bool) ($validated['show_voters'] ?? false);

        SurveyGuard::namesAllowed($retro, $showVoters);

        return [
            'kind' => $kind,
            'question' => $validated['question'],
            'description' => $validated['description'] ?? null,
            'options' => $options,
            'show_voters' => $showVoters,
        ];
    }

    /**
     * @param  array<int, string>  $options
     */
    private function ensureOptionsMatch(SurveyKind $kind, array $options): void
    {
        if (! $kind->isChoice() && $options !== []) {
            throw ValidationException::withMessages(['options' => __('Free-text surveys have no options.')]);
        }

        if (! $kind->isChoice()) {
            return;
        }

        if (count($options) >= self::MinOptions && count($options) <= self::MaxOptions) {
            return;
        }

        throw ValidationException::withMessages(['options' => __('Choice surveys need between 2 and 10 options.')]);
    }

    /**
     * @param  array<int, string>  $labels
     */
    private function replaceOptions(Survey $survey, array $labels): void
    {
        $survey->options()->delete();

        foreach ($labels as $position => $label) {
            $survey->options()->create(['label' => $label, 'position' => $position]);
        }
    }
}
```

- [ ] **Step 6: Register the routes**

In `routes/web.php`, add `use App\Http\Controllers\Retros\SurveysController;` and, inside the `retros/{retro}` group after the action-item routes:

```php
        Route::post('surveys', [SurveysController::class, 'store'])->name('retros.surveys.store');
        Route::get('surveys/{survey}', [SurveysController::class, 'show'])->name('retros.surveys.show')->whereUuid('survey');
        Route::patch('surveys/{survey}', [SurveysController::class, 'update'])->name('retros.surveys.update')->whereUuid('survey');
        Route::delete('surveys/{survey}', [SurveysController::class, 'destroy'])->name('retros.surveys.destroy')->whereUuid('survey');
```

- [ ] **Step 7: Translations**

| key | fr | es | de |
|---|---|---|---|
| A retrospective can have at most 10 surveys. | Une rétrospective peut avoir au plus 10 sondages. | Una retrospectiva puede tener como máximo 10 encuestas. | Eine Retrospektive kann höchstens 10 Umfragen haben. |
| Choice surveys need between 2 and 10 options. | Les sondages à choix ont besoin de 2 à 10 options. | Las encuestas de opciones necesitan entre 2 y 10 opciones. | Auswahlumfragen brauchen zwischen 2 und 10 Optionen. |
| Free-text surveys have no options. | Les sondages à réponse libre n'ont pas d'options. | Las encuestas de texto libre no tienen opciones. | Freitext-Umfragen haben keine Optionen. |
| This survey already has answers. | Ce sondage a déjà des réponses. | Esta encuesta ya tiene respuestas. | Diese Umfrage hat bereits Antworten. |
| Names are never shown on anonymous retros. | Les noms ne sont jamais affichés dans les rétros anonymes. | Los nombres nunca se muestran en las retros anónimas. | Namen werden in anonymen Retros nie angezeigt. |
| This survey is closed. | Ce sondage est clos. | Esta encuesta está cerrada. | Diese Umfrage ist geschlossen. |
| Answer the survey to join the discussion. | Répondez au sondage pour rejoindre la discussion. | Responde a la encuesta para unirte a la conversación. | Beantworte die Umfrage, um an der Diskussion teilzunehmen. |

Add each key to `lang/en.json` (value = key) and the translations to `lang/{fr,es,de}.json`, keeping the files' alphabetical key order.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/SurveysTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.

```bash
git add app routes lang tests/Feature/Retros/SurveysTest.php
git commit -m "feat: let the facilitator create, edit and delete surveys"
```

---

### Task 4: Answering, withdrawing, closing and reopening; completion closes surveys

**Files:**
- Create: `app/Http/Controllers/Retros/SurveyResponsesController.php`, `app/Http/Controllers/Retros/SurveyClosuresController.php`, `app/Actions/Surveys/CloseOpenSurveys.php`
- Modify: `app/Actions/Retros/ChangeRetroPhase.php` (Plan 8a), `routes/web.php`
- Test: `tests/Feature/Retros/SurveyAnswersTest.php`

**Interfaces:**
- Consumes: `SurveyGuard`, `SurveyChanged::for()`, `PresentSurvey::handle()` (Tasks 2–3); `ChangeRetroPhase::handle(Retro $locked, RetroPhase $phase): void` (Plan 8a).
- Produces:
  - Routes: `retros.surveys.response.update` PUT `surveys/{survey}/response` (`{optionId}` for single, `{optionIds}` for multiple, `{text}` for text), `retros.surveys.response.destroy` DELETE `surveys/{survey}/response`, `retros.surveys.closure.update` PUT `surveys/{survey}/closure` (close), `retros.surveys.closure.destroy` DELETE `surveys/{survey}/closure` (reopen). All return `{survey: SurveyPayload}` for the viewer.
  - `App\Actions\Surveys\CloseOpenSurveys::handle(Retro $locked): void` (closes every open survey of the retro and bumps their version), called by `ChangeRetroPhase` when moving to `Completed`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/SurveyAnswersTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\SurveyChanged;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyResponse;
use App\Models\SurveyTextAnswer;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function answeringRetro(RetroPhase $phase = RetroPhase::Voting, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroMember($retro);

    return [$retro, $user, $participant];
}

it('answers a single choice survey, changes the answer and withdraws it', function () {
    [$retro, $user, $participant] = answeringRetro();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    [$yes, $no] = $survey->options->all();
    $route = route('retros.surveys.response.update', [$retro, $survey]);

    $this->actingAs($user)->putJson($route, ['optionId' => $yes->id])
        ->assertOk()
        ->assertJsonPath('survey.myOptionIds', [$yes->id])
        ->assertJsonPath('survey.resultsVisible', true)
        ->assertJsonPath('survey.options.0.count', 1);
    $this->actingAs($user)->putJson($route, ['optionId' => $no->id])
        ->assertJsonPath('survey.myOptionIds', [$no->id])
        ->assertJsonPath('survey.options.0.count', 0)
        ->assertJsonPath('survey.responseCount', 1);

    expect(SurveyResponse::count())->toBe(1);

    $this->actingAs($user)->deleteJson(route('retros.surveys.response.destroy', [$retro, $survey]))
        ->assertOk()
        ->assertJsonPath('survey.myOptionIds', [])
        ->assertJsonPath('survey.resultsVisible', false)
        ->assertJsonPath('survey.options.0.count', null);

    expect(SurveyResponse::count())->toBe(0);
    Event::assertDispatched(SurveyChanged::class, 3);
});

it('stores several options on a multiple choice survey and replaces them', function () {
    [$retro, $user] = answeringRetro();
    $survey = Survey::factory()->multiple()->withOptions()->create(['retro_id' => $retro->id]);
    [$first, $second, $third] = $survey->options->all();
    $route = route('retros.surveys.response.update', [$retro, $survey]);

    $this->actingAs($user)->putJson($route, ['optionIds' => [$first->id, $third->id]])
        ->assertOk()
        ->assertJsonPath('survey.myOptionIds', [$first->id, $third->id])
        ->assertJsonPath('survey.responseCount', 1);
    $this->actingAs($user)->putJson($route, ['optionIds' => [$second->id]])
        ->assertJsonPath('survey.myOptionIds', [$second->id]);

    expect(SurveyResponse::pluck('survey_option_id')->all())->toBe([$second->id]);
});

it('stores a trimmed free-text answer and lets its author update it', function () {
    [$retro, $user, $participant] = answeringRetro();
    $survey = Survey::factory()->text()->create(['retro_id' => $retro->id]);
    $route = route('retros.surveys.response.update', [$retro, $survey]);

    $this->actingAs($user)->putJson($route, ['text' => '  More pairing  '])
        ->assertOk()
        ->assertJsonPath('survey.myText', 'More pairing')
        ->assertJsonPath('survey.textAnswers.0.isMine', true);
    $this->actingAs($user)->putJson($route, ['text' => 'Less meetings'])
        ->assertJsonPath('survey.myText', 'Less meetings');

    expect(SurveyTextAnswer::where('participant_id', $participant->id)->pluck('content')->all())->toBe(['Less meetings']);
});

it('rejects answers that do not match the survey kind', function (string $factoryState, array $body) {
    [$retro, $user] = answeringRetro();
    $survey = Survey::factory()->{$factoryState}()->withOptions()->create(['retro_id' => $retro->id]);
    $options = $survey->options->pluck('id')->all();
    $foreign = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, 'position' => 1])->options->first()->id;
    $resolved = json_decode(strtr(json_encode($body), [
        'OPTION_A' => $options[0] ?? 'none',
        'OPTION_B' => $options[1] ?? 'none',
        'FOREIGN' => $foreign,
    ]), true);

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $survey]), $resolved)->assertUnprocessable();

    expect(SurveyResponse::where('survey_id', $survey->id)->count())->toBe(0)
        ->and(SurveyTextAnswer::where('survey_id', $survey->id)->count())->toBe(0);
})->with([
    'single with two options' => ['single', ['optionIds' => ['OPTION_A', 'OPTION_B']]],
    'single with text' => ['single', ['text' => 'hello']],
    'single with a foreign option' => ['single', ['optionId' => 'FOREIGN']],
    'multiple with one id field' => ['multiple', ['optionId' => 'OPTION_A']],
    'multiple with nothing chosen' => ['multiple', ['optionIds' => []]],
    'multiple with a foreign option' => ['multiple', ['optionIds' => ['OPTION_A', 'FOREIGN']]],
    'multiple with a duplicate' => ['multiple', ['optionIds' => ['OPTION_A', 'OPTION_A']]],
    'text with an option' => ['text', ['optionId' => 'OPTION_A']],
    'text empty' => ['text', ['text' => '   ']],
    'text too long' => ['text', ['text' => str_repeat('a', 501)]],
]);

it('refuses answers on closed surveys', function () {
    [$retro, $user, $participant] = answeringRetro();
    $survey = Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $survey]), ['optionId' => $survey->options->first()->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['survey' => 'This survey is closed.']);

    answerSurvey($survey, $participant, 0);

    $this->actingAs($user)->deleteJson(route('retros.surveys.response.destroy', [$retro, $survey]))->assertUnprocessable();

    expect(SurveyResponse::count())->toBe(1);
});

it('refuses answers outside the board phases and while locked', function (RetroPhase $phase, array $attributes, int $status) {
    [$retro, $user] = answeringRetro($phase, $attributes);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $survey]), ['optionId' => $survey->options->first()->id])
        ->assertStatus($status);
})->with([
    'icebreaker' => [RetroPhase::Icebreaker, [], 403],
    'completed' => [RetroPhase::Completed, [], 403],
    'locked' => [RetroPhase::Writing, ['is_locked' => true], 423],
]);

it('lets guests answer', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->putJson(route('retros.surveys.response.update', [$retro, $survey]), ['optionId' => $survey->options->first()->id])
        ->assertOk();
});

it('never broadcasts the chosen option, the text or who answered', function () {
    [$retro, $user, $participant] = answeringRetro();
    $survey = Survey::factory()->text()->create(['retro_id' => $retro->id, 'show_voters' => true]);

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $survey]), ['text' => 'secret feedback'])->assertOk();

    Event::assertDispatched(SurveyChanged::class, fn (SurveyChanged $event) => $event->broadcastWith() === ['surveyId' => $survey->id, 'version' => 1, 'responseCount' => 1]
        && ! str_contains(json_encode($event->broadcastWith()), 'secret feedback')
        && ! str_contains(json_encode($event->broadcastWith()), $participant->id));
});

it('returns 404 for a deleted survey or a survey of another retro', function () {
    [$retro, $user] = answeringRetro();
    $foreign = Survey::factory()->withOptions()->create();
    $deleted = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    $optionId = $deleted->options->first()->id;
    $deleted->delete();

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $foreign]), ['optionId' => $foreign->options->first()->id])->assertNotFound();
    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $deleted->id]), ['optionId' => $optionId])->assertNotFound();

    expect(SurveyResponse::count())->toBe(0);
});

it('lets the facilitator close and reopen a survey, even while locked', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['is_locked' => true]);
    [$user] = retroFacilitator($retro);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->putJson(route('retros.surveys.closure.update', [$retro, $survey]))
        ->assertOk()
        ->assertJsonPath('survey.isClosed', true)
        ->assertJsonPath('survey.resultsVisible', true)
        ->assertJsonPath('survey.version', 2);
    $this->actingAs($user)->deleteJson(route('retros.surveys.closure.destroy', [$retro, $survey]))
        ->assertOk()
        ->assertJsonPath('survey.isClosed', false)
        ->assertJsonPath('survey.version', 3);

    Event::assertDispatched(SurveyChanged::class, 2);
});

it('keeps closing to the facilitator and out of completed retros', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($member)->putJson(route('retros.surveys.closure.update', [$retro, $survey]))->assertForbidden();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($facilitator)->deleteJson(route('retros.surveys.closure.destroy', [$retro, $survey]))->assertForbidden();
});

it('closes every open survey at completion and keeps them closed after a reopen', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroFacilitator($retro);
    $open = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    $closed = Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id, 'position' => 1, 'version' => 4]);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertOk();

    expect($open->fresh()->is_closed)->toBeTrue()
        ->and($open->fresh()->version)->toBe(2)
        ->and($closed->fresh()->version)->toBe(4);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'discussing'])->assertOk();

    expect($open->fresh()->is_closed)->toBeTrue();

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $open]), ['optionId' => $open->options->first()->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['survey' => 'This survey is closed.']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/SurveyAnswersTest.php`
Expected: FAIL with `Route [retros.surveys.response.update] not defined.`

- [ ] **Step 3: Create the answer controller**

`app/Http/Controllers/Retros/SurveyResponsesController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Surveys\PresentSurvey;
use App\Actions\Surveys\SurveyGuard;
use App\Enums\SurveyKind;
use App\Events\Retros\SurveyChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class SurveyResponsesController extends Controller
{
    public function __construct(private PresentSurvey $presentSurvey) {}

    public function update(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro, $survey);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($request, $retro, $survey, $participant): array {
            [$locked, $fresh] = $this->lock($retro, $survey);

            $validated = Validator::make($request->all(), $this->rules($fresh))->validate();

            $this->clear($fresh, $participant);
            $this->store($fresh, $participant, $validated);

            SurveyChanged::for($fresh)->sendToOthers();

            return [$fresh, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($fresh, $presentingRetro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro, $survey);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $survey, $participant): array {
            [$locked, $fresh] = $this->lock($retro, $survey);

            $this->clear($fresh, $participant);

            SurveyChanged::for($fresh)->sendToOthers();

            return [$fresh, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($fresh, $presentingRetro, $participant)]);
    }

    private function guard(Retro $retro, Survey $survey): void
    {
        SurveyGuard::activePhase($retro);
        RetroGuard::unlocked($retro);
        SurveyGuard::open($survey);
    }

    /**
     * The answer is validated against the locked survey so a concurrent
     * edit of its kind or options cannot slip a mismatched answer in.
     *
     * @return array{0: Retro, 1: Survey}
     */
    private function lock(Retro $retro, Survey $survey): array
    {
        $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
        $fresh = $locked->surveys()->whereKey($survey->id)->lockForUpdate()->firstOrFail();

        $this->guard($locked, $fresh);

        return [$locked, $fresh];
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function rules(Survey $survey): array
    {
        $optionOfThisSurvey = Rule::exists('survey_options', 'id')->where('survey_id', $survey->id);

        return match ($survey->kind) {
            SurveyKind::Single => [
                'optionId' => ['required', 'uuid', $optionOfThisSurvey],
                'optionIds' => ['prohibited'],
                'text' => ['prohibited'],
            ],
            SurveyKind::Multiple => [
                'optionIds' => ['required', 'array', 'min:1'],
                'optionIds.*' => ['uuid', 'distinct', $optionOfThisSurvey],
                'optionId' => ['prohibited'],
                'text' => ['prohibited'],
            ],
            SurveyKind::Text => [
                'text' => ['required', 'string', 'max:500'],
                'optionId' => ['prohibited'],
                'optionIds' => ['prohibited'],
            ],
        };
    }

    private function clear(Survey $survey, Participant $participant): void
    {
        $survey->responses()->where('participant_id', $participant->id)->delete();
        $survey->textAnswers()->where('participant_id', $participant->id)->delete();
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function store(Survey $survey, Participant $participant, array $validated): void
    {
        if ($survey->kind === SurveyKind::Text) {
            $survey->textAnswers()->create(['participant_id' => $participant->id, 'content' => $validated['text']]);

            return;
        }

        $optionIds = $survey->kind === SurveyKind::Single ? [$validated['optionId']] : $validated['optionIds'];

        foreach ($optionIds as $optionId) {
            $survey->responses()->create(['survey_option_id' => $optionId, 'participant_id' => $participant->id]);
        }
    }
}
```

- [ ] **Step 4: Create the closure controller**

`app/Http/Controllers/Retros/SurveyClosuresController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Surveys\PresentSurvey;
use App\Actions\Surveys\SurveyGuard;
use App\Events\Retros\SurveyChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SurveyClosuresController extends Controller
{
    public function __construct(private PresentSurvey $presentSurvey) {}

    public function update(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        return $this->setClosed($request, $retro, $survey, true);
    }

    public function destroy(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        return $this->setClosed($request, $retro, $survey, false);
    }

    private function setClosed(Request $request, Retro $retro, Survey $survey, bool $isClosed): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        SurveyGuard::notCompleted($retro);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $survey, $participant, $isClosed): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            SurveyGuard::notCompleted($locked);

            $fresh = $locked->surveys()->whereKey($survey->id)->firstOrFail();

            if ($fresh->is_closed !== $isClosed) {
                $fresh->is_closed = $isClosed;
                $fresh->version++;
                $fresh->save();

                SurveyChanged::for($fresh)->sendToOthers();
            }

            return [$fresh, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($fresh, $presentingRetro, $participant)]);
    }
}
```

- [ ] **Step 5: Close open surveys at completion**

`app/Actions/Surveys/CloseOpenSurveys.php`:

```php
<?php

namespace App\Actions\Surveys;

use App\Models\Retro;
use Illuminate\Support\Facades\DB;

class CloseOpenSurveys
{
    public function handle(Retro $locked): void
    {
        $locked->surveys()->where('is_closed', false)->update([
            'is_closed' => true,
            'version' => DB::raw('version + 1'),
        ]);
    }
}
```

In `app/Actions/Retros/ChangeRetroPhase.php` (created by Plan 8a with no constructor and private steps `ensureReachable`, `move`, `broadcast`), add `use App\Actions\Surveys\CloseOpenSurveys;`, add the constructor above `handle()`:

```php
    public function __construct(private CloseOpenSurveys $closeOpenSurveys) {}
```

replace `handle()` with:

```php
    public function handle(Retro $locked, RetroPhase $phase): void
    {
        $this->ensureReachable($locked, $phase);
        $this->move($locked, $phase);
        $this->closeSurveys($locked, $phase);
        $this->broadcast($locked, $phase);
    }
```

and add the private step after `move()`:

```php
    private function closeSurveys(Retro $locked, RetroPhase $phase): void
    {
        if ($phase !== RetroPhase::Completed) {
            return;
        }

        $this->closeOpenSurveys->handle($locked);
    }
```

No survey broadcast is needed: `phase.changed` makes every client refetch the snapshot.

- [ ] **Step 6: Register the routes**

In `routes/web.php`, add `use App\Http\Controllers\Retros\SurveyClosuresController;` and `use App\Http\Controllers\Retros\SurveyResponsesController;`, then after the survey routes of Task 3:

```php
        Route::put('surveys/{survey}/closure', [SurveyClosuresController::class, 'update'])->name('retros.surveys.closure.update')->whereUuid('survey');
        Route::delete('surveys/{survey}/closure', [SurveyClosuresController::class, 'destroy'])->name('retros.surveys.closure.destroy')->whereUuid('survey');
        Route::put('surveys/{survey}/response', [SurveyResponsesController::class, 'update'])->name('retros.surveys.response.update')->whereUuid('survey');
        Route::delete('surveys/{survey}/response', [SurveyResponsesController::class, 'destroy'])->name('retros.surveys.response.destroy')->whereUuid('survey');
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/SurveyAnswersTest.php tests/Feature/Retros/FacilitationTest.php`
Expected: PASS.

- [ ] **Step 8: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.

```bash
git add app routes tests/Feature/Retros/SurveyAnswersTest.php
git commit -m "feat: answer, withdraw, close and reopen surveys"
```

---
### Task 5: Survey reactions, threaded comments and comment notifications (backend)

**Files:**
- Create: `app/Http/Controllers/Retros/SurveyReactionsController.php`, `app/Http/Controllers/Retros/SurveyCommentsController.php`, `app/Events/Retros/SurveyDiscussionChanged.php`, `app/Events/Retros/OwnSurveyCommentSaved.php`
- Modify: `app/Actions/Retros/RetroGuard.php`, `app/Events/Retros/CommentNotification.php`, `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/Retros/SurveyDiscussionTest.php`

**Interfaces:**
- Consumes: `SurveyGuard`, `PresentSurvey`, generalised `PresentComment` and `SummarizeReactions` (Tasks 2–3), `App\Rules\SingleEmoji`, `RetroGuard::{unlocked,reactionsEnabled}`.
- Produces:
  - Routes: `retros.surveys.reactions.update` PUT / `retros.surveys.reactions.destroy` DELETE `surveys/{survey}/reactions` `{emoji}` → `{survey}`; `retros.surveys.comments.store` POST `surveys/{survey}/comments` `{content, parentCommentId?}` → 201 `{comment}`; `retros.survey-comments.update` PATCH `survey-comments/{surveyComment}` `{content}` → `{comment}`; `retros.survey-comments.destroy` DELETE `survey-comments/{surveyComment}` → 204. Survey comment payload = card comment payload with `surveyId` instead of `cardId`.
  - Events: `SurveyDiscussionChanged` → `survey.discussion.changed {surveyId, commentCount}` (presence channel); `OwnSurveyCommentSaved` → `own-survey-comment.saved {comment}` on `participant.{id}`; `comment.notification` payload with `surveyId` instead of `cardId`.
  - `RetroGuard::commentAuthor(CardComment|SurveyComment $comment, Participant $participant): void`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/SurveyDiscussionTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\CommentCreated;
use App\Events\Retros\CommentNotification;
use App\Events\Retros\OwnSurveyCommentSaved;
use App\Events\Retros\SurveyDiscussionChanged;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyReaction;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function discussedSurvey(RetroPhase $phase = RetroPhase::Discussing, array $retroAttributes = [], array $surveyAttributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($retroAttributes);
    [$user, $participant] = retroMember($retro);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, ...$surveyAttributes]);

    return [$retro, $user, $participant, $survey];
}

it('refuses reactions and comments until the viewer can see the results', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey();

    $this->actingAs($user)->putJson(route('retros.surveys.reactions.update', [$retro, $survey]), ['emoji' => '👍'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Answer the survey to join the discussion.');
    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Hmm'])->assertForbidden();

    answerSurvey($survey, $participant, 0);

    $this->actingAs($user)->putJson(route('retros.surveys.reactions.update', [$retro, $survey]), ['emoji' => '👍'])->assertOk();
    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Hmm'])->assertCreated();
});

it('opens the discussion of a closed survey to everyone', function () {
    [$retro, $user, , $survey] = discussedSurvey(RetroPhase::Discussing, [], ['is_closed' => true]);

    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Late thought'])->assertCreated();
});

it('hides the discussion again after the viewer withdraws their answer', function () {
    [$retro, $user, , $survey] = discussedSurvey();
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'content' => 'Visible after answering']);

    $this->actingAs($user)->putJson(route('retros.surveys.response.update', [$retro, $survey]), ['optionId' => $survey->options->first()->id])
        ->assertJsonPath('survey.comments.0.content', 'Visible after answering');
    $this->actingAs($user)->deleteJson(route('retros.surveys.response.destroy', [$retro, $survey]))
        ->assertJsonPath('survey.comments', [])
        ->assertJsonPath('survey.reactions', [])
        ->assertJsonPath('survey.commentCount', 1);
    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Sneaky'])->assertForbidden();
});

it('toggles reactions idempotently and broadcasts only the survey and its comment count', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey();
    answerSurvey($survey, $participant, 0);
    $route = route('retros.surveys.reactions.update', [$retro, $survey]);

    $this->actingAs($user)->putJson($route, ['emoji' => '🎉'])->assertOk();
    $this->actingAs($user)->putJson($route, ['emoji' => '🎉'])
        ->assertJsonPath('survey.reactions', [['emoji' => '🎉', 'count' => 1, 'mine' => true, 'names' => []]]);

    expect(SurveyReaction::count())->toBe(1);
    Event::assertDispatched(SurveyDiscussionChanged::class, fn (SurveyDiscussionChanged $event) => $event->broadcastAs() === 'survey.discussion.changed'
        && $event->broadcastWith() === ['surveyId' => $survey->id, 'commentCount' => 0]);

    $this->actingAs($user)->deleteJson(route('retros.surveys.reactions.destroy', [$retro, $survey]), ['emoji' => '🎉'])
        ->assertJsonPath('survey.reactions', []);
});

it('names reactions only when show who answered is on a named retro', function (bool $isAnonymous, array $names) {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['is_anonymous' => $isAnonymous]);
    [$user, $participant] = retroMember($retro);
    $survey = Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id, 'show_voters' => true]);

    $this->actingAs($user)->putJson(route('retros.surveys.reactions.update', [$retro, $survey]), ['emoji' => '👍'])
        ->assertJsonPath('survey.reactions.0.names', $names === [] ? [] : [$user->name]);
})->with([
    'named retro' => [false, ['name']],
    'anonymous retro' => [true, []],
]);

it('refuses survey reactions once completed, while locked, when turned off, and with a non-emoji', function (RetroPhase $phase, array $attributes, array $body, int $status) {
    [$retro, $user, $participant, $survey] = discussedSurvey($phase, $attributes);
    answerSurvey($survey, $participant, 0);

    $this->actingAs($user)->putJson(route('retros.surveys.reactions.update', [$retro, $survey]), $body)->assertStatus($status);
})->with([
    'completed' => [RetroPhase::Completed, [], ['emoji' => '👍'], 403],
    'locked' => [RetroPhase::Grouping, ['is_locked' => true], ['emoji' => '👍'], 423],
    'turned off' => [RetroPhase::Voting, ['reactions_enabled' => false], ['emoji' => '👍'], 403],
    'not an emoji' => [RetroPhase::Writing, [], ['emoji' => 'lol'], 422],
]);

it('comments on a survey and sends the author their comment on their private channel only', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey();
    answerSurvey($survey, $participant, 0);

    $response = $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => ' Agreed '])
        ->assertCreated()
        ->assertJsonPath('comment.surveyId', $survey->id)
        ->assertJsonPath('comment.content', 'Agreed')
        ->assertJsonPath('comment.author.id', $participant->id);

    Event::assertNotDispatched(CommentCreated::class);
    Event::assertDispatched(SurveyDiscussionChanged::class, fn (SurveyDiscussionChanged $event) => $event->broadcastWith() === ['surveyId' => $survey->id, 'commentCount' => 1]);
    Event::assertDispatched(OwnSurveyCommentSaved::class, fn (OwnSurveyCommentSaved $event) => $event->comment['id'] === $response->json('comment.id')
        && $event->broadcastAs() === 'own-survey-comment.saved'
        && $event->broadcastOn()->name === "private-participant.{$participant->id}");
});

it('hides survey comment authors from others on anonymous retros', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey(RetroPhase::Discussing, ['is_anonymous' => true], ['is_closed' => true]);
    [$otherUser] = retroMember($retro);

    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Quiet'])->assertCreated();

    $this->actingAs($otherUser)->getJson(route('retros.surveys.show', [$retro, $survey]))
        ->assertJsonPath('survey.comments.0.author', null)
        ->assertDontSee($participant->id);
});

it('attaches replies to the top-level comment and refuses parents of another survey', function () {
    [$retro, $user, , $survey] = discussedSurvey(RetroPhase::Discussing, [], ['is_closed' => true]);
    $parent = SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id]);
    $reply = SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'parent_comment_id' => $parent->id]);
    $foreign = SurveyComment::factory()->create(['retro_id' => $retro->id]);
    $route = route('retros.surveys.comments.store', [$retro, $survey]);

    $this->actingAs($user)->postJson($route, ['content' => 'Me too', 'parentCommentId' => $reply->id])
        ->assertCreated()
        ->assertJsonPath('comment.parentCommentId', $parent->id);
    $this->actingAs($user)->postJson($route, ['content' => 'Lost', 'parentCommentId' => $foreign->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['parentCommentId' => 'The reply must belong to a comment on the same survey.']);
});

it('lets authors edit and authors or the facilitator delete survey comments', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey(RetroPhase::Discussing, [], ['is_closed' => true]);
    [$facilitatorUser] = retroFacilitator($retro);
    [$otherUser] = retroMember($retro);
    $comment = SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $participant->id]);
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'parent_comment_id' => $comment->id]);

    $this->actingAs($otherUser)->patchJson(route('retros.survey-comments.update', [$retro, $comment]), ['content' => 'Hijack'])->assertForbidden();
    $this->actingAs($user)->patchJson(route('retros.survey-comments.update', [$retro, $comment]), ['content' => 'Edited'])
        ->assertOk()
        ->assertJsonPath('comment.content', 'Edited');
    $this->actingAs($otherUser)->deleteJson(route('retros.survey-comments.destroy', [$retro, $comment]))->assertForbidden();
    $this->actingAs($facilitatorUser)->deleteJson(route('retros.survey-comments.destroy', [$retro, $comment]))->assertNoContent();

    expect($comment->fresh()->isDeleted())->toBeTrue()
        ->and($comment->fresh()->content)->toBeNull();
    Event::assertDispatched(SurveyDiscussionChanged::class, fn (SurveyDiscussionChanged $event) => $event->commentCount === 1);
});

it('returns 404 for survey comments of another retro', function () {
    [$retro, $user] = discussedSurvey();
    $foreign = SurveyComment::factory()->create();

    $this->actingAs($user)->patchJson(route('retros.survey-comments.update', [$retro, $foreign]), ['content' => 'x'])->assertNotFound();
});

it('notifies the survey creator and thread participants who can see the results', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $creator] = retroFacilitator($retro);
    [, $threadStarter] = retroMember($retro);
    [, $withdrawn] = retroMember($retro);
    [$replierUser, $replier] = retroMember($retro);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $creator->id]);
    answerSurvey($survey, $creator, 0);
    answerSurvey($survey, $threadStarter, 1);
    answerSurvey($survey, $replier, 2);
    $thread = SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $threadStarter->id]);
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $withdrawn->id, 'parent_comment_id' => $thread->id]);

    $this->actingAs($replierUser)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), [
        'content' => 'Replying',
        'parentCommentId' => $thread->id,
    ])->assertCreated();

    $notified = [];
    Event::assertDispatched(CommentNotification::class, function (CommentNotification $event) use (&$notified, $survey, $thread, $replierUser) {
        $notified[] = $event->participantId;

        return $event->notification['surveyId'] === $survey->id
            && $event->notification['threadId'] === $thread->id
            && $event->notification['authorName'] === $replierUser->name
            && ! array_key_exists('cardId', $event->notification);
    });

    expect($notified)->toEqualCanonicalizing([$creator->id, $threadStarter->id]);
});

it('leaves the author name out of survey notifications on anonymous retros', function () {
    [$retro, $user, $participant, $survey] = discussedSurvey(RetroPhase::Discussing, ['is_anonymous' => true], ['is_closed' => true]);

    $this->actingAs($user)->postJson(route('retros.surveys.comments.store', [$retro, $survey]), ['content' => 'Hi'])->assertCreated();

    Event::assertDispatched(CommentNotification::class, fn (CommentNotification $event) => $event->participantId === $survey->created_by_participant_id
        && ! array_key_exists('authorName', $event->notification));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/SurveyDiscussionTest.php`
Expected: FAIL with `Route [retros.surveys.reactions.update] not defined.`

- [ ] **Step 3: Generalise the comment author guard and the notification payload**

In `app/Actions/Retros/RetroGuard.php`, add `use App\Models\SurveyComment;` and change the signature of `commentAuthor`:

```php
    public static function commentAuthor(CardComment|SurveyComment $comment, Participant $participant): void
```

In `app/Events/Retros/CommentNotification.php`, change the constructor docblock to:

```php
    /**
     * @param  array{cardId?: string, surveyId?: string, commentId: string, threadId: string, excerpt: string, authorName?: string}  $notification
     */
```

- [ ] **Step 4: Create the events**

`app/Events/Retros/SurveyDiscussionChanged.php`:

```php
<?php

namespace App\Events\Retros;

class SurveyDiscussionChanged extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $surveyId, public int $commentCount)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'survey.discussion.changed';
    }

    public function broadcastWith(): array
    {
        return ['surveyId' => $this->surveyId, 'commentCount' => $this->commentCount];
    }
}
```

`app/Events/Retros/OwnSurveyCommentSaved.php`:

```php
<?php

namespace App\Events\Retros;

use Illuminate\Broadcasting\PrivateChannel;

class OwnSurveyCommentSaved extends RetroBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $comment
     */
    public function __construct(string $retroId, public string $participantId, public array $comment)
    {
        parent::__construct($retroId);
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("participant.{$this->participantId}");
    }

    public function broadcastAs(): string
    {
        return 'own-survey-comment.saved';
    }

    public function broadcastWith(): array
    {
        return ['comment' => $this->comment];
    }
}
```

- [ ] **Step 5: Create the reactions controller**

`app/Http/Controllers/Retros/SurveyReactionsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Surveys\PresentSurvey;
use App\Actions\Surveys\SurveyGuard;
use App\Events\Retros\SurveyDiscussionChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Rules\SingleEmoji;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SurveyReactionsController extends Controller
{
    public function __construct(private PresentSurvey $presentSurvey) {}

    public function update(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        return $this->toggle($request, $retro, $survey, adds: true);
    }

    public function destroy(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        return $this->toggle($request, $retro, $survey, adds: false);
    }

    private function toggle(Request $request, Retro $retro, Survey $survey, bool $adds): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro, $survey, $participant);

        $validated = $request->validate([
            'emoji' => ['required', 'string', new SingleEmoji],
        ]);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $survey, $participant, $validated, $adds): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->surveys()->whereKey($survey->id)->firstOrFail();

            $this->guard($locked, $fresh, $participant);

            if ($adds) {
                $fresh->reactions()->firstOrCreate(
                    ['participant_id' => $participant->id, 'emoji' => $validated['emoji']],
                    ['retro_id' => $locked->id],
                );
            }

            if (! $adds) {
                $fresh->reactions()->where('participant_id', $participant->id)->where('emoji', $validated['emoji'])->delete();
            }

            (new SurveyDiscussionChanged($locked->id, $fresh->id, $fresh->commentCount()))->sendToOthers();

            return [$fresh, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($fresh, $presentingRetro, $participant)]);
    }

    private function guard(Retro $retro, Survey $survey, Participant $participant): void
    {
        SurveyGuard::activePhase($retro);
        RetroGuard::unlocked($retro);
        RetroGuard::reactionsEnabled($retro);
        SurveyGuard::resultsVisible($survey, $participant);
    }
}
```

- [ ] **Step 6: Create the comments controller**

`app/Http/Controllers/Retros/SurveyCommentsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentComment;
use App\Actions\Retros\RetroGuard;
use App\Actions\Surveys\SurveyGuard;
use App\Events\Retros\CommentNotification;
use App\Events\Retros\OwnSurveyCommentSaved;
use App\Events\Retros\SurveyDiscussionChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SurveyCommentsController extends Controller
{
    public function __construct(private PresentComment $presentComment) {}

    public function store(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro, $survey, $participant);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:500'],
            'parentCommentId' => ['nullable', 'uuid'],
        ]);

        [$comment, $presentingRetro] = DB::transaction(function () use ($retro, $survey, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->surveys()->whereKey($survey->id)->firstOrFail();

            $this->guard($locked, $fresh, $participant);

            $comment = $fresh->comments()->create([
                'retro_id' => $locked->id,
                'participant_id' => $participant->id,
                'parent_comment_id' => $this->threadIdFor($fresh, $validated['parentCommentId'] ?? null),
                'content' => $validated['content'],
            ]);

            $comment->load('participant.user');

            $this->broadcastSaved($locked, $fresh, $comment, $participant);
            $this->notify($locked, $fresh, $comment, $participant);

            return [$comment, $locked];
        });

        return response()->json(['comment' => $this->presentComment->handle($comment, $presentingRetro, $participant)], 201);
    }

    public function update(Request $request, Retro $retro, SurveyComment $surveyComment): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro, $surveyComment->survey, $participant);
        abort_if($surveyComment->isDeleted(), 404);
        RetroGuard::commentAuthor($surveyComment, $participant);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:500'],
        ]);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $surveyComment, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->surveyComments()->whereKey($surveyComment->id)->firstOrFail();

            $this->guard($locked, $fresh->survey, $participant);
            abort_if($fresh->isDeleted(), 404);
            RetroGuard::commentAuthor($fresh, $participant);

            $fresh->update(['content' => $validated['content']]);
            $fresh->load('participant.user');

            $this->broadcastSaved($locked, $fresh->survey, $fresh, $participant);

            return [$fresh, $locked];
        });

        return response()->json(['comment' => $this->presentComment->handle($fresh, $presentingRetro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, SurveyComment $surveyComment): Response
    {
        $participant = Participant::current($request);

        $this->guard($retro, $surveyComment->survey, $participant);
        $this->guardDeletion($retro, $surveyComment, $participant);

        DB::transaction(function () use ($retro, $surveyComment, $participant): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->surveyComments()->whereKey($surveyComment->id)->firstOrFail();
            $survey = $fresh->survey;

            $this->guard($locked, $survey, $participant);
            $this->guardDeletion($locked, $fresh, $participant);

            $this->deleteComment($locked, $fresh);

            (new SurveyDiscussionChanged($locked->id, $survey->id, $survey->commentCount()))->sendToOthers();
        });

        return response()->noContent();
    }

    private function guard(Retro $retro, Survey $survey, Participant $participant): void
    {
        SurveyGuard::activePhase($retro);
        RetroGuard::unlocked($retro);
        SurveyGuard::resultsVisible($survey, $participant);
    }

    private function guardDeletion(Retro $retro, SurveyComment $comment, Participant $participant): void
    {
        abort_if($comment->isDeleted(), 404);

        if ($retro->isFacilitator($participant)) {
            return;
        }

        RetroGuard::commentAuthor($comment, $participant);
    }

    /**
     * A parent with replies is soft-deleted so the thread survives; a reply
     * whose soft-deleted parent has no reply left takes the parent with it.
     */
    private function deleteComment(Retro $retro, SurveyComment $comment): void
    {
        if ($comment->parent_comment_id === null && $comment->replies()->exists()) {
            $comment->update(['content' => null, 'deleted_at' => now()]);

            return;
        }

        $comment->delete();

        $parent = $comment->parent_comment_id === null ? null : $retro->surveyComments()->whereKey($comment->parent_comment_id)->first();

        if ($parent === null || ! $parent->isDeleted() || $parent->replies()->exists()) {
            return;
        }

        $parent->delete();
    }

    private function threadIdFor(Survey $survey, ?string $parentCommentId): ?string
    {
        if ($parentCommentId === null) {
            return null;
        }

        $parent = $survey->comments()->whereKey($parentCommentId)->first();

        if ($parent === null) {
            throw ValidationException::withMessages(['parentCommentId' => __('The reply must belong to a comment on the same survey.')]);
        }

        return $parent->threadId();
    }

    private function broadcastSaved(Retro $retro, Survey $survey, SurveyComment $comment, Participant $author): void
    {
        (new SurveyDiscussionChanged($retro->id, $survey->id, $survey->commentCount()))->sendToOthers();
        (new OwnSurveyCommentSaved($retro->id, $author->id, $this->presentComment->handle($comment, $retro, $author)))->sendToOthers();
    }

    /**
     * Only recipients who can already see the survey's results are told,
     * so a notification never reveals the discussion early.
     */
    private function notify(Retro $retro, Survey $survey, SurveyComment $comment, Participant $commenter): void
    {
        $threadParticipantIds = $comment->parent_comment_id === null
            ? collect()
            : $survey->comments()
                ->where(fn ($query) => $query->whereKey($comment->parent_comment_id)->orWhere('parent_comment_id', $comment->parent_comment_id))
                ->pluck('participant_id');

        $answeredIds = $survey->is_closed ? null : $survey->answeredParticipantIds();

        $recipients = $threadParticipantIds
            ->push($survey->created_by_participant_id)
            ->filter()
            ->unique()
            ->reject(fn (string $participantId) => $participantId === $commenter->id)
            ->filter(fn (string $participantId) => $answeredIds === null || $answeredIds->contains($participantId));

        $notification = [
            'surveyId' => $survey->id,
            'commentId' => $comment->id,
            'threadId' => $comment->threadId(),
            'excerpt' => Str::limit((string) $comment->content, 79, '…'),
            ...($retro->is_anonymous ? [] : ['authorName' => $commenter->displayName()]),
        ];

        foreach ($recipients as $participantId) {
            (new CommentNotification($retro->id, $participantId, $notification))->sendToOthers();
        }
    }
}
```

- [ ] **Step 7: Register the routes**

In `routes/web.php`, add `use App\Http\Controllers\Retros\SurveyCommentsController;` and `use App\Http\Controllers\Retros\SurveyReactionsController;`, then after the survey routes of Task 4:

```php
        Route::put('surveys/{survey}/reactions', [SurveyReactionsController::class, 'update'])->name('retros.surveys.reactions.update')->whereUuid('survey');
        Route::delete('surveys/{survey}/reactions', [SurveyReactionsController::class, 'destroy'])->name('retros.surveys.reactions.destroy')->whereUuid('survey');
        Route::post('surveys/{survey}/comments', [SurveyCommentsController::class, 'store'])->name('retros.surveys.comments.store')->whereUuid('survey');
        Route::patch('survey-comments/{surveyComment}', [SurveyCommentsController::class, 'update'])->name('retros.survey-comments.update')->whereUuid('surveyComment');
        Route::delete('survey-comments/{surveyComment}', [SurveyCommentsController::class, 'destroy'])->name('retros.survey-comments.destroy')->whereUuid('surveyComment');
```

`scopeBindings()` resolves `{surveyComment}` through `Retro::surveyComments()` (Task 1), so a comment of another retro is a 404.

- [ ] **Step 8: Translations**

| key | fr | es | de |
|---|---|---|---|
| The reply must belong to a comment on the same survey. | La réponse doit porter sur un commentaire du même sondage. | La respuesta debe pertenecer a un comentario de la misma encuesta. | Die Antwort muss zu einem Kommentar derselben Umfrage gehören. |

- [ ] **Step 9: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/SurveyDiscussionTest.php tests/Feature/Retros/CardCommentsTest.php tests/Feature/Retros/BroadcastAuthorizationTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 10: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.

```bash
git add app routes lang tests/Feature/Retros/SurveyDiscussionTest.php
git commit -m "feat: react to and discuss surveys once their results are visible"
```

---
### Task 6: Frontend foundation — survey types, reducer, events and debounced refetch

**Files:**
- Create: `resources/js/lib/retro/survey-api.ts`
- Modify: `resources/js/lib/retro/types.ts`, `resources/js/lib/retro/board-reducer.ts`, `resources/js/hooks/use-retro-channel.ts`, `resources/js/hooks/use-retro-board.ts`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Wayfinder `SurveysController.show({retro, survey})` (generated after Tasks 3–5), snapshot `surveys`, events `survey.changed`, `survey.deleted`, `survey.discussion.changed`, private `own-survey-comment.saved`, `comment.notification` with `surveyId`.
- Produces:
  - Types `SurveyKind`, `SurveyOption`, `SurveyTextAnswer`, `SurveyComment`, `SurveyCommentThread`, `SurveyPayload`; `Snapshot.surveys: SurveyPayload[]`; `CommentNotificationPayload.cardId?` / `surveyId?`.
  - Reducer actions `{type: 'survey.upsert', survey}`, `{type: 'survey.remove', surveyId}`, `{type: 'survey.counts', surveyId, responseCount?, commentCount?}`.
  - `survey-api.ts`: `SurveyPhases: RetroPhase[]`, `MaxSurveys = 10`, `SurveyRefetchDelayMs = 1000`, `fetchSurvey(retroId, surveyId): Promise<SurveyPayload>`, `needsSurveyRefetch(local, version): boolean`, `createSurveyRefetcher(retroId, handlers): SurveyRefetcher` (`schedule(surveyId)`, `cancel()`).
  - `RetroChannelHandlers.onOwnSurveyComment(comment: SurveyComment)`.

- [ ] **Step 1: Generate the route helpers**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form`
Expected: `resources/js/actions/App/Http/Controllers/Retros/{SurveysController,SurveyClosuresController,SurveyResponsesController,SurveyReactionsController,SurveyCommentsController}.ts` exist.

- [ ] **Step 2: Add the types**

In `resources/js/lib/retro/types.ts`, change `CommentNotificationPayload` to:

```ts
export type CommentNotificationPayload = {
    cardId?: string;
    surveyId?: string;
    commentId: string;
    threadId: string;
    excerpt: string;
    authorName?: string;
};
```

add after `CommentNotificationPayload`:

```ts
export type SurveyKind = 'single' | 'multiple' | 'text';

export type SurveyOption = {
    id: string;
    label: string;
    position: number;
    count: number | null;
    voters: string[] | null;
};

export type SurveyTextAnswer = {
    id: string;
    text: string;
    authorId: string | null;
    isMine: boolean;
};

export type SurveyComment = Omit<CardComment, 'cardId'> & { surveyId: string };

export type SurveyCommentThread = SurveyComment & { replies: SurveyComment[] };

export type SurveyPayload = {
    id: string;
    kind: SurveyKind;
    question: string;
    description: string | null;
    position: number;
    isClosed: boolean;
    version: number;
    showVoters: boolean;
    responseCount: number;
    myOptionIds: string[];
    myText: string | null;
    resultsVisible: boolean;
    options: SurveyOption[];
    textAnswers: SurveyTextAnswer[] | null;
    reactions: ReactionSummary[];
    commentCount: number;
    comments: SurveyCommentThread[];
};
```

and add to `Snapshot`, after `actionItems: ActionItem[];`:

```ts
    surveys: SurveyPayload[];
```

- [ ] **Step 3: Add the reducer actions**

In `resources/js/lib/retro/board-reducer.ts`, add `SurveyPayload` to the type import and these members to `BoardAction`:

```ts
    | { type: 'survey.upsert'; survey: SurveyPayload }
    | { type: 'survey.remove'; surveyId: string }
    | {
          type: 'survey.counts';
          surveyId: string;
          responseCount?: number;
          commentCount?: number;
      }
```

and these cases at the end of the `switch` in `boardReducer`:

```ts
        case 'survey.upsert':
            return {
                ...state,
                surveys: [
                    ...state.surveys.filter(
                        (survey) => survey.id !== action.survey.id,
                    ),
                    action.survey,
                ].sort((a, b) => a.position - b.position),
            };
        case 'survey.remove':
            return {
                ...state,
                surveys: state.surveys.filter(
                    (survey) => survey.id !== action.surveyId,
                ),
            };
        case 'survey.counts':
            return {
                ...state,
                surveys: state.surveys.map((survey) =>
                    survey.id === action.surveyId
                        ? {
                              ...survey,
                              responseCount:
                                  action.responseCount ?? survey.responseCount,
                              commentCount:
                                  action.commentCount ?? survey.commentCount,
                          }
                        : survey,
                ),
            };
```

- [ ] **Step 4: Create the survey API helpers**

`resources/js/lib/retro/survey-api.ts`:

```ts
import SurveysController from '@/actions/App/Http/Controllers/Retros/SurveysController';
import { RetroRequestError, retroRequest } from './api';
import type { RetroPhase, SurveyPayload } from './types';

export const SurveyPhases: RetroPhase[] = [
    'writing',
    'grouping',
    'voting',
    'discussing',
];

export const MaxSurveys = 10;

export const SurveyRefetchDelayMs = 1_000;

export async function fetchSurvey(
    retroId: string,
    surveyId: string,
): Promise<SurveyPayload> {
    const response = await retroRequest<{ survey: SurveyPayload }>(
        SurveysController.show({ retro: retroId, survey: surveyId }),
    );

    return response.survey;
}

/**
 * Broadcasts only carry counts; the survey itself is refetched when it is
 * new, changed shape, or the viewer may see its results.
 */
export function needsSurveyRefetch(
    local: SurveyPayload | undefined,
    version: number,
): boolean {
    if (local === undefined) {
        return true;
    }

    return local.version !== version || local.resultsVisible;
}

export type SurveyRefetcher = {
    schedule: (surveyId: string) => void;
    cancel: () => void;
};

type Handlers = {
    onSurvey: (survey: SurveyPayload) => void;
    onGone: (surveyId: string) => void;
    onError: (error: unknown) => void;
};

/**
 * Collapses every survey event of one second into a single request per
 * survey, so a burst of answers does not make every client refetch each
 * time.
 */
export function createSurveyRefetcher(
    retroId: string,
    handlers: Handlers,
): SurveyRefetcher {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const load = async (surveyId: string) => {
        try {
            handlers.onSurvey(await fetchSurvey(retroId, surveyId));
        } catch (error) {
            if (error instanceof RetroRequestError && error.status === 404) {
                handlers.onGone(surveyId);

                return;
            }

            handlers.onError(error);
        }
    };

    return {
        schedule(surveyId) {
            if (timers.has(surveyId)) {
                return;
            }

            timers.set(
                surveyId,
                setTimeout(() => {
                    timers.delete(surveyId);
                    void load(surveyId);
                }, SurveyRefetchDelayMs),
            );
        },
        cancel() {
            timers.forEach((timer) => clearTimeout(timer));
            timers.clear();
        },
    };
}
```

- [ ] **Step 5: Listen to the survey events**

In `resources/js/hooks/use-retro-channel.ts`:

- add `SurveyComment` to the type import from `@/lib/retro/types`;
- append to `RetroEvents` (before `] as const;`):

```ts
    'survey.changed',
    'survey.deleted',
    'survey.discussion.changed',
```

- add to `RetroChannelHandlers`:

```ts
    onOwnSurveyComment: (comment: SurveyComment) => void;
```

- chain on the private channel, after the `.own-comment.saved` listener:

```ts
            .listen(
                '.own-survey-comment.saved',
                (payload: { comment: SurveyComment }) =>
                    handlers.current.onOwnSurveyComment(payload.comment),
            )
```

- [ ] **Step 6: Apply the survey events on the board**

In `resources/js/hooks/use-retro-board.ts`:

- change the React import to `import { useCallback, useEffect, useReducer, useRef, useState } from 'react';`;
- add the imports:

```ts
import {
    createSurveyRefetcher,
    needsSurveyRefetch,
    type SurveyRefetcher,
} from '@/lib/retro/survey-api';
```

and add `SurveyComment` to the type import from `@/lib/retro/types`;

- after `const latestBoard = useRef(board);` add:

```ts
    const surveyRefetcher = useRef<SurveyRefetcher | null>(null);
```

- add these cases to the `switch` in `onEvent` (before `case 'phase.changed':`):

```ts
                case 'survey.changed': {
                    const surveyId = payload.surveyId as string;
                    const local = latestBoard.current.surveys.find(
                        (survey) => survey.id === surveyId,
                    );

                    apply({
                        type: 'survey.counts',
                        surveyId,
                        responseCount: payload.responseCount as number,
                    });

                    if (needsSurveyRefetch(local, payload.version as number)) {
                        surveyRefetcher.current?.schedule(surveyId);
                    }

                    break;
                }
                case 'survey.deleted':
                    apply({
                        type: 'survey.remove',
                        surveyId: payload.surveyId as string,
                    });
                    break;
                case 'survey.discussion.changed': {
                    const surveyId = payload.surveyId as string;

                    apply({
                        type: 'survey.counts',
                        surveyId,
                        commentCount: payload.commentCount as number,
                    });

                    if (
                        latestBoard.current.surveys.find(
                            (survey) => survey.id === surveyId,
                        )?.resultsVisible
                    ) {
                        surveyRefetcher.current?.schedule(surveyId);
                    }

                    break;
                }
```

- after `onOwnComment`, add:

```ts
    const onOwnSurveyComment = useCallback(
        (comment: SurveyComment) =>
            surveyRefetcher.current?.schedule(comment.surveyId),
        [],
    );
```

- replace the body of `onCommentNotification` with:

```ts
        (notification: CommentNotificationPayload) => {
            if (notification.cardId) {
                notifications.notify(notification.cardId);
            }

            const isReply = notification.threadId !== notification.commentId;
            const title = isReply
                ? t('New reply in a thread you follow')
                : notification.surveyId
                  ? t('New comment on your survey')
                  : t('New comment on your card');

            toast(title, {
                description: notification.authorName
                    ? `${notification.authorName}: ${notification.excerpt}`
                    : notification.excerpt,
            });
        },
```

- pass `onOwnSurveyComment` in the handlers object given to `useRetroChannel` (next to `onOwnComment`);
- right after the `handleError` `useCallback`, add:

```ts
    useEffect(() => {
        const refetcher = createSurveyRefetcher(retroId, {
            onSurvey: (survey) => {
                if (isActive.current) {
                    apply({ type: 'survey.upsert', survey });
                }
            },
            onGone: (surveyId) => apply({ type: 'survey.remove', surveyId }),
            onError: (error) => {
                handleError(error);
            },
        });

        surveyRefetcher.current = refetcher;

        return () => {
            refetcher.cancel();
            surveyRefetcher.current = null;
        };
    }, [retroId, apply, handleError]);
```

- [ ] **Step 7: Translations**

| key | fr | es | de |
|---|---|---|---|
| New comment on your survey | Nouveau commentaire sur votre sondage | Nuevo comentario en tu encuesta | Neuer Kommentar zu deiner Umfrage |

- [ ] **Step 8: Check types and lint**

Run: `npx vp fmt resources/js/lib/retro/types.ts resources/js/lib/retro/board-reducer.ts resources/js/lib/retro/survey-api.ts resources/js/hooks/use-retro-channel.ts resources/js/hooks/use-retro-board.ts && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: clean (pre-existing failures only); translation test PASS.

- [ ] **Step 9: Commit**

```bash
git add resources/js lang
git commit -m "feat: keep surveys in sync on the board through survey events"
```

---

### Task 7: Extract reusable reaction chips and comment threads from the card UI

**Files:**
- Create: `resources/js/components/retro/reaction-chips.tsx`, `resources/js/components/retro/comment-thread.tsx`
- Modify: `resources/js/components/retro/card-reactions.tsx`, `resources/js/components/retro/card-comments.tsx`

**Interfaces:**
- Consumes: `EmojiPicker`, `dragIsolation`, `useBoard()`.
- Produces:
  - `ReactionChips({reactions: ReactionSummary[], canReact: boolean, onToggle: (emoji: string) => void})` and `optimisticReactions(reactions, emoji, removing): ReactionSummary[]`.
  - `ThreadComment` type, `ThreadWithReplies<T>`, `CommentThreadActions<T>` (`create(content, parentCommentId): Promise<boolean>`, `update(comment, content): Promise<boolean>`, `remove(comment, hasReplies): Promise<void>`), and `CommentThreadList<T>({threads, canWrite, actions, composerNote?})`.
  - Card behaviour unchanged (pure refactor).

- [ ] **Step 1: Create the reaction chips**

`resources/js/components/retro/reaction-chips.tsx`:

```tsx
import { SmilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { ReactionSummary } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { dragIsolation } from './dnd';
import { EmojiPicker } from './emoji-picker';

type Props = {
    reactions: ReactionSummary[];
    canReact: boolean;
    onToggle: (emoji: string) => void;
};

export function ReactionChips({ reactions, canReact, onToggle }: Props) {
    const { t } = useTrans();

    return (
        <div
            {...dragIsolation}
            className="mt-2 flex flex-wrap items-center gap-1"
        >
            {reactions.map((reaction) => (
                <Tooltip key={reaction.emoji}>
                    <TooltipTrigger asChild>
                        <span
                            tabIndex={canReact ? -1 : 0}
                            className="inline-flex"
                        >
                            <Button
                                size="sm"
                                variant="outline"
                                className={cn(
                                    'h-6 gap-1 rounded-full px-2 text-xs',
                                    reaction.mine &&
                                        'border-primary bg-primary/10',
                                )}
                                aria-pressed={reaction.mine}
                                aria-label={t(
                                    reaction.count === 1
                                        ? ':emoji, :count reaction'
                                        : ':emoji, :count reactions',
                                    {
                                        emoji: reaction.emoji,
                                        count: reaction.count,
                                    },
                                )}
                                disabled={!canReact}
                                onClick={() => onToggle(reaction.emoji)}
                            >
                                <span>{reaction.emoji}</span>
                                <span>{reaction.count}</span>
                            </Button>
                        </span>
                    </TooltipTrigger>
                    {reaction.names.length > 0 && (
                        <TooltipContent>
                            {reaction.names.join(', ')}
                        </TooltipContent>
                    )}
                </Tooltip>
            ))}
            {canReact && (
                <EmojiPicker label={t('Add a reaction')} onPick={onToggle}>
                    <Button size="icon" variant="ghost" className="size-6">
                        <SmilePlus className="size-3.5" />
                    </Button>
                </EmojiPicker>
            )}
        </div>
    );
}

export function optimisticReactions(
    reactions: ReactionSummary[],
    emoji: string,
    removing: boolean,
): ReactionSummary[] {
    const existing = reactions.find((reaction) => reaction.emoji === emoji);

    if (removing && existing) {
        return reactions
            .map((reaction) =>
                reaction.emoji === emoji
                    ? { ...reaction, count: reaction.count - 1, mine: false }
                    : reaction,
            )
            .filter((reaction) => reaction.count > 0);
    }

    if (existing) {
        return reactions.map((reaction) =>
            reaction.emoji === emoji
                ? { ...reaction, count: reaction.count + 1, mine: true }
                : reaction,
        );
    }

    return [...reactions, { emoji, count: 1, mine: true, names: [] }];
}
```

- [ ] **Step 2: Use the chips for cards**

Replace `resources/js/components/retro/card-reactions.tsx` with:

```tsx
import CardReactionsController from '@/actions/App/Http/Controllers/Retros/CardReactionsController';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard, ReactionSummary } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { optimisticReactions, ReactionChips } from './reaction-chips';

type Response = { cardId: string; reactions: ReactionSummary[] };

const ReactionPhases = ['grouping', 'voting', 'discussing'];

export function CardReactions({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const { retro } = ctx.board;
    const canReact =
        retro.reactionsEnabled &&
        ctx.isEditable &&
        ReactionPhases.includes(retro.phase);

    if (!retro.reactionsEnabled || card.hidden) {
        return null;
    }

    const toggle = async (emoji: string) => {
        const existing = card.reactions.find(
            (reaction) => reaction.emoji === emoji,
        );
        const removing = existing?.mine === true;
        const route = { retro: retro.id, card: card.id };

        ctx.dispatch({
            type: 'reactions.set',
            cardId: card.id,
            reactions: optimisticReactions(card.reactions, emoji, removing),
        });

        const response = await ctx.run(
            retroRequest<Response>(
                removing
                    ? CardReactionsController.destroy(route)
                    : CardReactionsController.update(route),
                { emoji },
            ),
        );

        if (response) {
            ctx.apply({
                type: 'reactions.set',
                cardId: response.cardId,
                reactions: response.reactions,
            });
        }
    };

    return (
        <ReactionChips
            reactions={card.reactions}
            canReact={canReact}
            onToggle={(emoji) => void toggle(emoji)}
        />
    );
}
```

- [ ] **Step 3: Create the generic comment thread**

`resources/js/components/retro/comment-thread.tsx`:

```tsx
import { Pencil, Reply, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import type { Person } from '@/lib/retro/types';
import { useBoard } from './board-context';

export type ThreadComment = {
    id: string;
    parentCommentId: string | null;
    isMine: boolean;
    deleted: boolean;
    content: string | null;
    author: Person | null;
    createdAt: string;
};

export type ThreadWithReplies<T extends ThreadComment> = T & { replies: T[] };

export type CommentThreadActions<T extends ThreadComment> = {
    create: (
        content: string,
        parentCommentId: string | null,
    ) => Promise<boolean>;
    update: (comment: T, content: string) => Promise<boolean>;
    remove: (comment: T, hasReplies: boolean) => Promise<void>;
};

type Props<T extends ThreadComment> = {
    threads: ThreadWithReplies<T>[];
    canWrite: boolean;
    actions: CommentThreadActions<T>;
    composerNote?: string;
};

export function CommentThreadList<T extends ThreadComment>({
    threads,
    canWrite,
    actions,
    composerNote,
}: Props<T>) {
    const { t } = useTrans();

    return (
        <div className="mt-2 space-y-3 border-l pl-3">
            {threads.map((thread) => (
                <ThreadItem
                    key={thread.id}
                    thread={thread}
                    canWrite={canWrite}
                    actions={actions}
                />
            ))}
            {canWrite && composerNote && (
                <p className="text-xs text-muted-foreground">{composerNote}</p>
            )}
            {canWrite && (
                <CommentForm
                    actions={actions}
                    target={{ parentCommentId: null }}
                    placeholder={t('Write a comment…')}
                />
            )}
        </div>
    );
}

function ThreadItem<T extends ThreadComment>({
    thread,
    canWrite,
    actions,
}: {
    thread: ThreadWithReplies<T>;
    canWrite: boolean;
    actions: CommentThreadActions<T>;
}) {
    const { t } = useTrans();
    const [expanded, setExpanded] = useState(false);
    const [replying, setReplying] = useState(false);

    return (
        <div className="space-y-2">
            <CommentItem
                comment={thread}
                canWrite={canWrite}
                hasReplies={thread.replies.length > 0}
                actions={actions}
            />
            {thread.replies.length > 0 && (
                <Button
                    size="sm"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    aria-expanded={expanded}
                    onClick={() => setExpanded(!expanded)}
                >
                    {thread.replies.length === 1
                        ? t('1 reply')
                        : t(':count replies', { count: thread.replies.length })}
                </Button>
            )}
            {expanded && (
                <div className="space-y-2 pl-4">
                    {thread.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            canWrite={canWrite}
                            hasReplies={false}
                            actions={actions}
                        />
                    ))}
                </div>
            )}
            {canWrite && !replying && !thread.deleted && (
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 text-xs"
                    onClick={() => {
                        setReplying(true);
                        setExpanded(true);
                    }}
                >
                    <Reply className="size-3" />
                    {t('Reply')}
                </Button>
            )}
            {replying && (
                <div className="pl-4">
                    <CommentForm
                        actions={actions}
                        target={{ parentCommentId: thread.id }}
                        placeholder={t('Write a reply…')}
                        onDone={() => setReplying(false)}
                    />
                </div>
            )}
        </div>
    );
}

function CommentItem<T extends ThreadComment>({
    comment,
    canWrite,
    hasReplies,
    actions,
}: {
    comment: T;
    canWrite: boolean;
    hasReplies: boolean;
    actions: CommentThreadActions<T>;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [removing, setRemoving] = useState(false);
    const removeInFlight = useRef(false);
    const canEdit = canWrite && comment.isMine;
    const canDelete =
        canWrite && (comment.isMine || ctx.board.viewer.isFacilitator);

    if (comment.deleted) {
        return (
            <p className="text-xs text-muted-foreground italic">
                {t('Comment deleted')}
            </p>
        );
    }

    const remove = async () => {
        if (removeInFlight.current) {
            return;
        }

        removeInFlight.current = true;
        setRemoving(true);

        await actions.remove(comment, hasReplies).finally(() => {
            removeInFlight.current = false;
            setRemoving(false);
        });
    };

    if (editing) {
        return (
            <CommentForm
                actions={actions}
                target={{ comment }}
                placeholder={t('Edit comment')}
                onDone={() => setEditing(false)}
            />
        );
    }

    return (
        <div className="text-xs">
            <p className="font-medium">
                {comment.author?.name ?? t('Anonymous')}
            </p>
            <p className="break-words whitespace-pre-wrap">{comment.content}</p>
            {(canEdit || canDelete) && (
                <div className="mt-1 flex gap-1">
                    {canEdit && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={t('Edit comment')}
                            onClick={() => setEditing(true)}
                        >
                            <Pencil className="size-3" />
                        </Button>
                    )}
                    {canDelete && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={t('Delete comment')}
                            disabled={removing}
                            onClick={() => void remove()}
                        >
                            <Trash2 className="size-3" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

type FormTarget<T> = { parentCommentId: string | null } | { comment: T };

function CommentForm<T extends ThreadComment>({
    actions,
    target,
    placeholder,
    onDone,
}: {
    actions: CommentThreadActions<T>;
    target: FormTarget<T>;
    placeholder: string;
    onDone?: () => void;
}) {
    const { t } = useTrans();
    const editedComment = 'comment' in target ? target.comment : null;
    const [content, setContent] = useState(editedComment?.content ?? '');
    const [sending, setSending] = useState(false);
    const sendInFlight = useRef(false);
    const submitLabel = editedComment
        ? t('Save')
        : 'parentCommentId' in target && target.parentCommentId === null
          ? t('Comment')
          : t('Reply');

    const submit = async () => {
        const trimmed = content.trim();

        if (trimmed === '' || sendInFlight.current) {
            return;
        }

        sendInFlight.current = true;
        setSending(true);

        const saved = await ('comment' in target
            ? actions.update(target.comment, trimmed)
            : actions.create(trimmed, target.parentCommentId)
        ).finally(() => {
            sendInFlight.current = false;
            setSending(false);
        });

        if (!saved) {
            return;
        }

        setContent('');
        onDone?.();
    };

    return (
        <form
            className="space-y-1"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <Textarea
                value={content}
                maxLength={500}
                rows={2}
                placeholder={placeholder}
                aria-label={placeholder}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void submit();
                    }
                }}
            />
            <div className="flex justify-end gap-1">
                {onDone && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={onDone}
                    >
                        {t('Cancel')}
                    </Button>
                )}
                <Button size="sm" disabled={sending || content.trim() === ''}>
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}
```

- [ ] **Step 4: Use the thread for cards**

Replace `resources/js/components/retro/card-comments.tsx` with:

```tsx
import { MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import CardCommentsController from '@/actions/App/Http/Controllers/Retros/CardCommentsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard, CardComment } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { CommentThreadList, type CommentThreadActions } from './comment-thread';
import { dragIsolation } from './dnd';

const CommentPhases = ['grouping', 'voting', 'discussing'];

export function CardComments({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const phase = ctx.board.retro.phase;
    const isUnread = ctx.unreadCardIds.has(card.id);
    const { markCommentsRead } = ctx;

    useEffect(() => {
        if (open && isUnread) {
            markCommentsRead(card.id);
        }
    }, [open, isUnread, card.id, markCommentsRead]);

    if (card.hidden || (phase === 'writing' && card.commentCount === 0)) {
        return null;
    }

    return (
        <div {...dragIsolation} className="mt-2">
            <Button
                size="sm"
                variant="ghost"
                className="relative h-7 gap-1"
                aria-expanded={open}
                aria-label={t('Comments (:count)', {
                    count: card.commentCount,
                })}
                onClick={() => setOpen(!open)}
            >
                <MessageSquare className="size-3.5" />
                {card.commentCount}
                {isUnread && (
                    <span
                        role="img"
                        className="absolute top-1 right-1 size-2 rounded-full bg-primary"
                        aria-label={t('Unread comments')}
                    />
                )}
            </Button>
            {open && <CardThread card={card} />}
        </div>
    );
}

function CardThread({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const retroId = ctx.board.retro.id;
    const canWrite =
        ctx.isEditable && CommentPhases.includes(ctx.board.retro.phase);

    const save = async (
        request: Promise<{ comment: CardComment }>,
    ): Promise<boolean> => {
        const response = await ctx.run(request);

        if (!response) {
            return false;
        }

        ctx.apply({ type: 'comment.upsert', comment: response.comment });

        return true;
    };

    const actions: CommentThreadActions<CardComment> = {
        create: (content, parentCommentId) =>
            save(
                retroRequest<{ comment: CardComment }>(
                    CardCommentsController.store({
                        retro: retroId,
                        card: card.id,
                    }),
                    { content, parentCommentId },
                ),
            ),
        update: (comment, content) =>
            save(
                retroRequest<{ comment: CardComment }>(
                    CardCommentsController.update({
                        retro: retroId,
                        comment: comment.id,
                    }),
                    { content },
                ),
            ),
        remove: async (comment, hasReplies) => {
            const result = await ctx.run(
                retroRequest(
                    CardCommentsController.destroy({
                        retro: retroId,
                        comment: comment.id,
                    }),
                ),
            );

            if (result === undefined) {
                return;
            }

            ctx.apply({
                type: 'comment.remove',
                cardId: comment.cardId,
                commentId: comment.id,
                soft: comment.parentCommentId === null && hasReplies,
            });

            if (comment.parentCommentId === null) {
                return;
            }

            const thread = card.comments.find(
                (candidate) => candidate.id === comment.parentCommentId,
            );

            if (thread?.deleted && thread.replies.length === 1) {
                ctx.apply({
                    type: 'comment.remove',
                    cardId: comment.cardId,
                    commentId: thread.id,
                    soft: false,
                });
            }
        },
    };

    return (
        <CommentThreadList
            threads={card.comments}
            canWrite={canWrite}
            actions={actions}
        />
    );
}
```

- [ ] **Step 5: Check types and lint**

Run: `npx vp fmt resources/js/components/retro/reaction-chips.tsx resources/js/components/retro/comment-thread.tsx resources/js/components/retro/card-reactions.tsx resources/js/components/retro/card-comments.tsx && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: clean; translation test PASS (every key moved keeps its literal `t()` call).

- [ ] **Step 6: Manual check (card behaviour unchanged)**

With `composer run dev` running, in a `Grouping` retro: react to a card, remove the reaction, comment, reply, edit, delete a parent with a reply (shows "Comment deleted"), then delete the reply (both disappear). Everything behaves as before.

- [ ] **Step 7: Commit**

```bash
git add resources/js/components/retro
git commit -m "refactor: extract reaction chips and comment threads for reuse"
```

---
### Task 8: Surveys column, survey cards, answering UI, survey dialog and facilitator menu

**Files:**
- Create: `resources/js/components/retro/surveys-column.tsx`, `resources/js/components/retro/survey-card.tsx`, `resources/js/components/retro/survey-dialog.tsx`, `resources/js/components/retro/survey-menu.tsx`
- Modify: `resources/js/components/retro/board.tsx`, `resources/js/components/retro/board-header.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 6 types, reducer actions and `survey-api.ts` (`SurveyPhases`, `MaxSurveys`); Wayfinder `SurveysController.{store,update,destroy}`, `SurveyResponsesController.{update,destroy}`, `SurveyClosuresController.{update,destroy}`.
- Produces: `SurveysColumn()` (leftmost column in `Writing`–`Discussing` when the retro has surveys), `AddSurveyButton()` (facilitator toolbar button), `SurveyCard({survey})`, `SurveyDialog({open, onOpenChange, survey?})` with exported `SurveyDraft` type (`{kind, question, description, options}`) held in the form's `draft` state — Plan 8e adds its "Generate from a prompt" field inside `SurveyForm` and fills the dialog through `setDraft`; `SurveyMenu({survey})`.

- [ ] **Step 1: Create the survey dialog**

`resources/js/components/retro/survey-dialog.tsx`:

```tsx
import { Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import SurveysController from '@/actions/App/Http/Controllers/Retros/SurveysController';
import InputError from '@/components/input-error';
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
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { SurveyKind, SurveyPayload } from '@/lib/retro/types';
import { useBoard } from './board-context';

const MinOptions = 2;
const MaxOptions = 10;

export type SurveyDraft = {
    kind: SurveyKind;
    question: string;
    description: string;
    options: string[];
};

export const SurveyKindLabels: Record<SurveyKind, string> = {
    single: 'Single choice',
    multiple: 'Multiple choice',
    text: 'Free text',
};

function draftOf(survey?: SurveyPayload): SurveyDraft {
    if (!survey) {
        return { kind: 'single', question: '', description: '', options: ['', ''] };
    }

    return {
        kind: survey.kind,
        question: survey.question,
        description: survey.description ?? '',
        options:
            survey.kind === 'text'
                ? ['', '']
                : survey.options.map((option) => option.label),
    };
}

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    survey?: SurveyPayload;
};

export function SurveyDialog({ open, onOpenChange, survey }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                {open && (
                    <SurveyForm
                        survey={survey}
                        onDone={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function SurveyForm({
    survey,
    onDone,
}: {
    survey?: SurveyPayload;
    onDone: () => void;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { retro } = ctx.board;
    const [draft, setDraft] = useState<SurveyDraft>(() => draftOf(survey));
    const [showVoters, setShowVoters] = useState(survey?.showVoters ?? false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const isChoice = draft.kind !== 'text';

    const setOption = (index: number, label: string) =>
        setDraft((current) => ({
            ...current,
            options: current.options.map((option, position) =>
                position === index ? label : option,
            ),
        }));

    const save = async (event: FormEvent) => {
        event.preventDefault();

        if (saving) {
            return;
        }

        setSaving(true);
        setError(null);

        const description = draft.description.trim();
        const route = survey
            ? SurveysController.update({ retro: retro.id, survey: survey.id })
            : SurveysController.store(retro.id);

        try {
            const response = await retroRequest<{ survey: SurveyPayload }>(
                route,
                {
                    kind: draft.kind,
                    question: draft.question.trim(),
                    description: description === '' ? null : description,
                    options: isChoice
                        ? draft.options.map((option) => option.trim())
                        : [],
                    show_voters: !retro.isAnonymous && showVoters,
                },
            );

            ctx.apply({ type: 'survey.upsert', survey: response.survey });
            onDone();
        } catch (caught) {
            const message = ctx.handleError(caught);

            if (message === null) {
                onDone();

                return;
            }

            setError(message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={(event) => void save(event)} className="space-y-4">
            <DialogTitle>
                {survey ? t('Edit survey') : t('New survey')}
            </DialogTitle>

            <div className="grid gap-2">
                <Label htmlFor="survey-kind">{t('Answer type')}</Label>
                <Select
                    value={draft.kind}
                    onValueChange={(value) =>
                        setDraft((current) => ({
                            ...current,
                            kind: value as SurveyKind,
                        }))
                    }
                >
                    <SelectTrigger id="survey-kind">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(Object.keys(SurveyKindLabels) as SurveyKind[]).map(
                            (kind) => (
                                <SelectItem key={kind} value={kind}>
                                    {t(SurveyKindLabels[kind])}
                                </SelectItem>
                            ),
                        )}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-2">
                <Label htmlFor="survey-question">{t('Question')}</Label>
                <Input
                    id="survey-question"
                    value={draft.question}
                    maxLength={200}
                    required
                    onChange={(event) =>
                        setDraft((current) => ({
                            ...current,
                            question: event.target.value,
                        }))
                    }
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="survey-description">
                    {t('Description (optional)')}
                </Label>
                <Textarea
                    id="survey-description"
                    value={draft.description}
                    maxLength={500}
                    rows={2}
                    onChange={(event) =>
                        setDraft((current) => ({
                            ...current,
                            description: event.target.value,
                        }))
                    }
                />
            </div>

            {isChoice && (
                <fieldset className="grid gap-2">
                    <legend className="mb-2 text-sm font-medium">
                        {t('Options')}
                    </legend>
                    {draft.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Input
                                value={option}
                                maxLength={100}
                                required
                                aria-label={t('Option :number', {
                                    number: index + 1,
                                })}
                                onChange={(event) =>
                                    setOption(index, event.target.value)
                                }
                            />
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={t('Remove option :number', {
                                    number: index + 1,
                                })}
                                disabled={draft.options.length <= MinOptions}
                                onClick={() =>
                                    setDraft((current) => ({
                                        ...current,
                                        options: current.options.filter(
                                            (_, position) => position !== index,
                                        ),
                                    }))
                                }
                            >
                                <X className="size-4" />
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="justify-self-start"
                        disabled={draft.options.length >= MaxOptions}
                        onClick={() =>
                            setDraft((current) => ({
                                ...current,
                                options: [...current.options, ''],
                            }))
                        }
                    >
                        <Plus className="size-4" />
                        {t('Add option')}
                    </Button>
                </fieldset>
            )}

            <div className="grid gap-1">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="survey-show-voters"
                        checked={!retro.isAnonymous && showVoters}
                        disabled={retro.isAnonymous}
                        onCheckedChange={(checked) =>
                            setShowVoters(checked === true)
                        }
                    />
                    <Label htmlFor="survey-show-voters">
                        {t('Show who answered')}
                    </Label>
                </div>
                {retro.isAnonymous && (
                    <p className="text-xs text-muted-foreground">
                        {t('Names are never shown on anonymous retros.')}
                    </p>
                )}
            </div>

            <InputError message={error ?? undefined} />

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                    {t('Save')}
                </Button>
            </DialogFooter>
        </form>
    );
}
```

- [ ] **Step 2: Create the facilitator survey menu**

`resources/js/components/retro/survey-menu.tsx`:

```tsx
import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import SurveyClosuresController from '@/actions/App/Http/Controllers/Retros/SurveyClosuresController';
import SurveysController from '@/actions/App/Http/Controllers/Retros/SurveysController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { SurveyPhases } from '@/lib/retro/survey-api';
import type { SurveyPayload } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { SurveyDialog } from './survey-dialog';

export function SurveyMenu({ survey }: { survey: SurveyPayload }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [busy, setBusy] = useState(false);
    const { retro, viewer } = ctx.board;

    if (!viewer.isFacilitator || retro.phase === 'completed') {
        return null;
    }

    const canEdit = ctx.isEditable && SurveyPhases.includes(retro.phase);
    const route = { retro: retro.id, survey: survey.id };

    const send = async (request: Promise<{ survey: SurveyPayload }>) => {
        setBusy(true);

        const response = await ctx.run(request).finally(() => setBusy(false));

        if (response) {
            ctx.apply({ type: 'survey.upsert', survey: response.survey });
        }
    };

    const destroy = async () => {
        setBusy(true);

        const result = await ctx
            .run(retroRequest(SurveysController.destroy(route)))
            .finally(() => setBusy(false));

        if (result === undefined) {
            return;
        }

        setConfirmingDelete(false);
        ctx.apply({ type: 'survey.remove', surveyId: survey.id });
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 shrink-0"
                        aria-label={t('Survey actions')}
                        disabled={busy}
                    >
                        <Ellipsis className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        disabled={!canEdit || survey.responseCount > 0}
                        onSelect={() => setEditing(true)}
                    >
                        {t('Edit survey')}
                    </DropdownMenuItem>
                    {survey.responseCount > 0 && (
                        <p className="px-2 pb-1 text-xs text-muted-foreground">
                            {t('Edit is only possible before the first answer.')}
                        </p>
                    )}
                    <DropdownMenuCheckboxItem
                        checked={survey.showVoters}
                        disabled={retro.isAnonymous}
                        onCheckedChange={(checked) =>
                            void send(
                                retroRequest<{ survey: SurveyPayload }>(
                                    SurveysController.update(route),
                                    { show_voters: checked === true },
                                ),
                            )
                        }
                    >
                        {t('Show who answered')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuItem
                        onSelect={() =>
                            void send(
                                retroRequest<{ survey: SurveyPayload }>(
                                    survey.isClosed
                                        ? SurveyClosuresController.destroy(route)
                                        : SurveyClosuresController.update(route),
                                ),
                            )
                        }
                    >
                        {survey.isClosed
                            ? t('Reopen survey')
                            : t('Close survey')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        disabled={!canEdit}
                        onSelect={() => setConfirmingDelete(true)}
                    >
                        {t('Delete survey')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <SurveyDialog
                open={editing && !ctx.sessionExpired}
                onOpenChange={setEditing}
                survey={survey}
            />
            <Dialog
                open={confirmingDelete && !ctx.sessionExpired}
                onOpenChange={setConfirmingDelete}
            >
                <DialogContent>
                    <DialogTitle>{t('Delete this survey?')}</DialogTitle>
                    <DialogDescription>
                        {t(
                            'Its answers, reactions and comments are deleted too.',
                        )}
                    </DialogDescription>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => setConfirmingDelete(false)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={busy}
                            onClick={() => void destroy()}
                        >
                            {t('Delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
```

- [ ] **Step 3: Create the survey card**

`resources/js/components/retro/survey-card.tsx`:

```tsx
import { Check } from 'lucide-react';
import { useState } from 'react';
import SurveyResponsesController from '@/actions/App/Http/Controllers/Retros/SurveyResponsesController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { SurveyPhases } from '@/lib/retro/survey-api';
import type {
    BoardParticipant,
    SurveyOption,
    SurveyPayload,
} from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { SurveyMenu } from './survey-menu';

type AnswerProps = {
    survey: SurveyPayload;
    canAnswer: boolean;
    busy: boolean;
    onAnswer: (body: Record<string, unknown>) => Promise<void>;
};

export function SurveyCard({ survey }: { survey: SurveyPayload }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const canAnswer =
        ctx.isEditable &&
        !survey.isClosed &&
        SurveyPhases.includes(ctx.board.retro.phase);
    const hasAnswered = survey.myOptionIds.length > 0 || survey.myText !== null;
    const route = { retro: ctx.board.retro.id, survey: survey.id };

    const send = async (request: () => Promise<{ survey: SurveyPayload }>) => {
        if (busy) {
            return;
        }

        setBusy(true);

        const response = await ctx.run(request()).finally(() => setBusy(false));

        if (response) {
            ctx.apply({ type: 'survey.upsert', survey: response.survey });
        }
    };

    const answer = (body: Record<string, unknown>) =>
        send(() =>
            retroRequest<{ survey: SurveyPayload }>(
                SurveyResponsesController.update(route),
                body,
            ),
        );

    const withdraw = () =>
        send(() =>
            retroRequest<{ survey: SurveyPayload }>(
                SurveyResponsesController.destroy(route),
            ),
        );

    return (
        <article
            aria-label={survey.question}
            className="space-y-2 rounded-md border bg-background p-3 shadow-xs"
        >
            <div className="flex items-start gap-2">
                <h3 className="min-w-0 flex-1 text-sm font-medium break-words">
                    {survey.question}
                </h3>
                {survey.isClosed && (
                    <Badge variant="secondary">{t('Closed')}</Badge>
                )}
                <SurveyMenu survey={survey} />
            </div>
            {survey.description && (
                <p className="text-xs break-words whitespace-pre-wrap text-muted-foreground">
                    {survey.description}
                </p>
            )}
            {survey.kind === 'multiple' && (
                <p className="text-xs text-muted-foreground">
                    {t('Several answers allowed')}
                </p>
            )}
            {survey.kind === 'text' ? (
                <TextSurvey
                    key={survey.myText ?? ''}
                    survey={survey}
                    canAnswer={canAnswer}
                    busy={busy}
                    onAnswer={answer}
                />
            ) : (
                <ChoiceSurvey
                    key={survey.myOptionIds.join()}
                    survey={survey}
                    canAnswer={canAnswer}
                    busy={busy}
                    onAnswer={answer}
                />
            )}
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                    {survey.responseCount === 1
                        ? t('1 response')
                        : t(':count responses', {
                              count: survey.responseCount,
                          })}
                </span>
                {canAnswer && hasAnswered && (
                    <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0 text-xs"
                        disabled={busy}
                        onClick={() => void withdraw()}
                    >
                        {t('Withdraw my answer')}
                    </Button>
                )}
            </div>
        </article>
    );
}

function ChoiceSurvey({ survey, canAnswer, busy, onAnswer }: AnswerProps) {
    const { t } = useTrans();
    const [selected, setSelected] = useState<string[]>(survey.myOptionIds);
    const isMultiple = survey.kind === 'multiple';
    const orderedSelection = survey.options
        .map((option) => option.id)
        .filter((id) => selected.includes(id));
    const hasChanged =
        orderedSelection.join() !==
        survey.options
            .map((option) => option.id)
            .filter((id) => survey.myOptionIds.includes(id))
            .join();

    return (
        <div className="space-y-2">
            <ul className="space-y-2">
                {survey.options.map((option) => {
                    const isMine = survey.myOptionIds.includes(option.id);

                    return (
                        <li key={option.id}>
                            {isMultiple ? (
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={selected.includes(option.id)}
                                        disabled={!canAnswer || busy}
                                        onCheckedChange={(checked) =>
                                            setSelected((current) =>
                                                checked === true
                                                    ? [...current, option.id]
                                                    : current.filter(
                                                          (id) =>
                                                              id !== option.id,
                                                      ),
                                            )
                                        }
                                    />
                                    <span className="min-w-0 flex-1 break-words">
                                        {option.label}
                                    </span>
                                </label>
                            ) : (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={isMine ? 'default' : 'outline'}
                                    className="h-auto w-full justify-start py-1.5 text-left whitespace-normal"
                                    aria-pressed={isMine}
                                    disabled={!canAnswer || busy}
                                    onClick={() =>
                                        void onAnswer({ optionId: option.id })
                                    }
                                >
                                    {isMine && (
                                        <Check className="size-3.5 shrink-0" />
                                    )}
                                    {option.label}
                                </Button>
                            )}
                            {survey.resultsVisible && (
                                <OptionResult
                                    option={option}
                                    responseCount={survey.responseCount}
                                />
                            )}
                        </li>
                    );
                })}
            </ul>
            {isMultiple && canAnswer && (
                <Button
                    size="sm"
                    disabled={busy || orderedSelection.length === 0 || !hasChanged}
                    onClick={() =>
                        void onAnswer({ optionIds: orderedSelection })
                    }
                >
                    {survey.myOptionIds.length > 0
                        ? t('Update answer')
                        : t('Submit')}
                </Button>
            )}
        </div>
    );
}

function OptionResult({
    option,
    responseCount,
}: {
    option: SurveyOption;
    responseCount: number;
}) {
    const { board } = useBoard();
    const count = option.count ?? 0;
    const percent =
        responseCount === 0 ? 0 : Math.round((count / responseCount) * 100);
    const voters = (option.voters ?? [])
        .map((id) => board.participants.find((person) => person.id === id))
        .filter(
            (person): person is BoardParticipant => person !== undefined,
        );

    return (
        <div className="mt-1 space-y-1">
            <div className="flex items-center gap-2 text-xs">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <span className="w-16 shrink-0 text-right text-muted-foreground tabular-nums">
                    {percent}% · {count}
                </span>
            </div>
            {voters.length > 0 && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex -space-x-1" tabIndex={0}>
                            {voters.map((voter) => (
                                <img
                                    key={voter.id}
                                    src={voter.avatarUrl}
                                    alt={voter.name}
                                    className="size-5 rounded-full border border-background"
                                />
                            ))}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        {voters.map((voter) => voter.name).join(', ')}
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
    );
}

function TextSurvey({ survey, canAnswer, busy, onAnswer }: AnswerProps) {
    const { t } = useTrans();
    const { board } = useBoard();
    const [text, setText] = useState(survey.myText ?? '');
    const trimmed = text.trim();

    return (
        <div className="space-y-2">
            {canAnswer && (
                <form
                    className="space-y-1"
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (trimmed !== '') {
                            void onAnswer({ text: trimmed });
                        }
                    }}
                >
                    <Textarea
                        value={text}
                        maxLength={500}
                        rows={2}
                        placeholder={t('Write your answer…')}
                        aria-label={t('Your answer')}
                        onChange={(event) => setText(event.target.value)}
                    />
                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            disabled={
                                busy ||
                                trimmed === '' ||
                                trimmed === survey.myText
                            }
                        >
                            {survey.myText === null
                                ? t('Submit')
                                : t('Update answer')}
                        </Button>
                    </div>
                </form>
            )}
            {survey.textAnswers !== null &&
                (survey.textAnswers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        {t('No answers yet.')}
                    </p>
                ) : (
                    <ul className="space-y-1" aria-label={t('Answers')}>
                        {survey.textAnswers.map((answer) => (
                            <li
                                key={answer.id}
                                className={cn(
                                    'rounded-sm border px-2 py-1 text-xs break-words whitespace-pre-wrap',
                                    answer.isMine && 'border-primary',
                                )}
                            >
                                {answer.text}
                                {answer.authorId && (
                                    <span className="block text-muted-foreground">
                                        {
                                            board.participants.find(
                                                (person) =>
                                                    person.id ===
                                                    answer.authorId,
                                            )?.name
                                        }
                                    </span>
                                )}
                                {answer.isMine && (
                                    <span className="block text-muted-foreground">
                                        {t('Your answer')}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                ))}
        </div>
    );
}
```

- [ ] **Step 4: Create the column and the toolbar button**

`resources/js/components/retro/surveys-column.tsx`:

```tsx
import { ListChecks } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { MaxSurveys, SurveyPhases } from '@/lib/retro/survey-api';
import { useBoard } from './board-context';
import { SurveyCard } from './survey-card';
import { SurveyDialog } from './survey-dialog';

export function SurveysColumn() {
    const { board } = useBoard();
    const { t } = useTrans();

    if (
        !SurveyPhases.includes(board.retro.phase) ||
        board.surveys.length === 0
    ) {
        return null;
    }

    return (
        <section
            aria-label={t('Surveys')}
            className="flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-t-4 border-t-primary bg-muted/30 p-3"
        >
            <h2 className="text-sm font-semibold">{t('Surveys')}</h2>
            {board.surveys.map((survey) => (
                <SurveyCard key={survey.id} survey={survey} />
            ))}
        </section>
    );
}

export function AddSurveyButton() {
    const ctx = useBoard();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const { board } = ctx;

    if (
        !board.viewer.isFacilitator ||
        !SurveyPhases.includes(board.retro.phase) ||
        !ctx.isEditable ||
        board.surveys.length >= MaxSurveys
    ) {
        return null;
    }

    return (
        <>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                <ListChecks className="size-4" />
                {t('Add survey')}
            </Button>
            <SurveyDialog
                open={open && !ctx.sessionExpired}
                onOpenChange={setOpen}
            />
        </>
    );
}
```

- [ ] **Step 5: Place the column and the button on the board**

In `resources/js/components/retro/board.tsx`, add `import { SurveysColumn } from './surveys-column';` and render `<SurveysColumn />` as the first child of `<main ref={setBoardElement} …>`, before `{board.columns.length === 0 && (…)}`.

In `resources/js/components/retro/board-header.tsx`, add `import { AddSurveyButton } from './surveys-column';` and render `<AddSurveyButton />` right after `{actions}`.

- [ ] **Step 6: Translations**

| key | fr | es | de |
|---|---|---|---|
| Surveys | Sondages | Encuestas | Umfragen |
| Add survey | Ajouter un sondage | Añadir encuesta | Umfrage hinzufügen |
| New survey | Nouveau sondage | Nueva encuesta | Neue Umfrage |
| Edit survey | Modifier le sondage | Editar encuesta | Umfrage bearbeiten |
| Answer type | Type de réponse | Tipo de respuesta | Antworttyp |
| Single choice | Choix unique | Opción única | Einzelauswahl |
| Multiple choice | Choix multiple | Opción múltiple | Mehrfachauswahl |
| Free text | Texte libre | Texto libre | Freitext |
| Question | Question | Pregunta | Frage |
| Description (optional) | Description (facultative) | Descripción (opcional) | Beschreibung (optional) |
| Options | Options | Opciones | Optionen |
| Option :number | Option :number | Opción :number | Option :number |
| Remove option :number | Retirer l'option :number | Quitar la opción :number | Option :number entfernen |
| Add option | Ajouter une option | Añadir opción | Option hinzufügen |
| Show who answered | Afficher qui a répondu | Mostrar quién respondió | Anzeigen, wer geantwortet hat |
| Several answers allowed | Plusieurs réponses possibles | Se permiten varias respuestas | Mehrere Antworten möglich |
| 1 response | 1 réponse | 1 respuesta | 1 Antwort |
| :count responses | :count réponses | :count respuestas | :count Antworten |
| Update answer | Modifier la réponse | Actualizar respuesta | Antwort aktualisieren |
| Withdraw my answer | Retirer ma réponse | Retirar mi respuesta | Meine Antwort zurückziehen |
| Your answer | Votre réponse | Tu respuesta | Deine Antwort |
| Write your answer… | Écrivez votre réponse… | Escribe tu respuesta… | Schreib deine Antwort… |
| Answers | Réponses | Respuestas | Antworten |
| No answers yet. | Pas encore de réponses. | Todavía no hay respuestas. | Noch keine Antworten. |
| Closed | Clos | Cerrada | Geschlossen |
| Survey actions | Actions du sondage | Acciones de la encuesta | Umfrageaktionen |
| Edit is only possible before the first answer. | La modification n'est possible qu'avant la première réponse. | Solo se puede editar antes de la primera respuesta. | Bearbeiten ist nur vor der ersten Antwort möglich. |
| Close survey | Clore le sondage | Cerrar encuesta | Umfrage schließen |
| Reopen survey | Rouvrir le sondage | Reabrir encuesta | Umfrage wieder öffnen |
| Delete survey | Supprimer le sondage | Eliminar encuesta | Umfrage löschen |
| Delete this survey? | Supprimer ce sondage ? | ¿Eliminar esta encuesta? | Diese Umfrage löschen? |
| Its answers, reactions and comments are deleted too. | Ses réponses, réactions et commentaires sont aussi supprimés. | También se eliminan sus respuestas, reacciones y comentarios. | Ihre Antworten, Reaktionen und Kommentare werden ebenfalls gelöscht. |

Add only keys missing from `lang/en.json` (Plan 8b may already have added "No answers yet." or "Answers"; keep the existing translation then). `SurveyKindLabels` values are passed through `t()` dynamically, so the three kind labels must be added even though the key extractor does not see them.

- [ ] **Step 7: Check types and lint**

Run: `npx vp fmt resources/js/components/retro/survey-dialog.tsx resources/js/components/retro/survey-menu.tsx resources/js/components/retro/survey-card.tsx resources/js/components/retro/surveys-column.tsx resources/js/components/retro/board.tsx resources/js/components/retro/board-header.tsx && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: clean; translation test PASS.

- [ ] **Step 8: Manual check**

With `composer run dev`, as facilitator in `Writing`: "Add survey" creates a single-choice survey (the Surveys column appears on the left); in a second browser as a member, the survey appears within ~1 s without counts; answer it — bars, percentages and "1 response" appear; the facilitator's copy shows "1 response" and, after answering, the counts. Create a multiple-choice survey (checkboxes + Submit, "Several answers allowed") and a free-text survey (textarea, answers listed alphabetically after answering). Toggle "Show who answered" — avatars appear under options; on an anonymous retro the switch is disabled with the hint. Close/Reopen, Edit (disabled once answered), Delete (confirm dialog).

- [ ] **Step 9: Commit**

```bash
git add resources/js lang
git commit -m "feat: show, answer and manage surveys on the board"
```

---

### Task 9: Survey reactions and discussion UI

**Files:**
- Create: `resources/js/components/retro/survey-discussion.tsx`
- Modify: `resources/js/components/retro/survey-card.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: `ReactionChips`, `optimisticReactions`, `CommentThreadList`, `CommentThreadActions` (Task 7); `fetchSurvey`, `SurveyPhases` (Task 6); Wayfinder `SurveyReactionsController.{update,destroy}`, `SurveyCommentsController.{store,update,destroy}` (`surveyComment` route parameter).
- Produces: `SurveyDiscussion({survey})` rendered at the bottom of every survey card.

- [ ] **Step 1: Create the discussion component**

`resources/js/components/retro/survey-discussion.tsx`:

```tsx
import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import SurveyCommentsController from '@/actions/App/Http/Controllers/Retros/SurveyCommentsController';
import SurveyReactionsController from '@/actions/App/Http/Controllers/Retros/SurveyReactionsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { fetchSurvey, SurveyPhases } from '@/lib/retro/survey-api';
import type { SurveyComment, SurveyPayload } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { CommentThreadList, type CommentThreadActions } from './comment-thread';
import { optimisticReactions, ReactionChips } from './reaction-chips';

export function SurveyDiscussion({ survey }: { survey: SurveyPayload }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const { retro } = ctx.board;
    const route = { retro: retro.id, survey: survey.id };
    const canDiscuss =
        ctx.isEditable &&
        survey.resultsVisible &&
        SurveyPhases.includes(retro.phase);
    const commentsLabel = t('Comments (:count)', {
        count: survey.commentCount,
    });

    if (!survey.resultsVisible) {
        return (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="size-3.5" aria-label={commentsLabel} />
                {survey.commentCount} · {t('Answer to join the discussion')}
            </p>
        );
    }

    const refresh = async () => {
        const fresh = await ctx.run(fetchSurvey(retro.id, survey.id));

        if (fresh) {
            ctx.apply({ type: 'survey.upsert', survey: fresh });
        }
    };

    const toggleReaction = async (emoji: string) => {
        const removing =
            survey.reactions.find((reaction) => reaction.emoji === emoji)
                ?.mine === true;

        ctx.dispatch({
            type: 'survey.upsert',
            survey: {
                ...survey,
                reactions: optimisticReactions(
                    survey.reactions,
                    emoji,
                    removing,
                ),
            },
        });

        const response = await ctx.run(
            retroRequest<{ survey: SurveyPayload }>(
                removing
                    ? SurveyReactionsController.destroy(route)
                    : SurveyReactionsController.update(route),
                { emoji },
            ),
        );

        if (response) {
            ctx.apply({ type: 'survey.upsert', survey: response.survey });
        }
    };

    const actions: CommentThreadActions<SurveyComment> = {
        create: async (content, parentCommentId) => {
            const response = await ctx.run(
                retroRequest<{ comment: SurveyComment }>(
                    SurveyCommentsController.store(route),
                    { content, parentCommentId },
                ),
            );

            if (!response) {
                return false;
            }

            void refresh();

            return true;
        },
        update: async (comment, content) => {
            const response = await ctx.run(
                retroRequest<{ comment: SurveyComment }>(
                    SurveyCommentsController.update({
                        retro: retro.id,
                        surveyComment: comment.id,
                    }),
                    { content },
                ),
            );

            if (!response) {
                return false;
            }

            void refresh();

            return true;
        },
        remove: async (comment) => {
            const result = await ctx.run(
                retroRequest(
                    SurveyCommentsController.destroy({
                        retro: retro.id,
                        surveyComment: comment.id,
                    }),
                ),
            );

            if (result !== undefined) {
                await refresh();
            }
        },
    };

    return (
        <div className="space-y-1">
            {retro.reactionsEnabled && (
                <ReactionChips
                    reactions={survey.reactions}
                    canReact={canDiscuss}
                    onToggle={(emoji) => void toggleReaction(emoji)}
                />
            )}
            <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1"
                aria-expanded={open}
                aria-label={commentsLabel}
                onClick={() => setOpen(!open)}
            >
                <MessageSquare className="size-3.5" />
                {survey.commentCount}
            </Button>
            {open && (
                <CommentThreadList
                    threads={survey.comments}
                    canWrite={canDiscuss}
                    actions={actions}
                    composerNote={
                        !survey.showVoters && !retro.isAnonymous
                            ? t('Your name is shown with your comment.')
                            : undefined
                    }
                />
            )}
        </div>
    );
}
```

- [ ] **Step 2: Render it on each survey card**

In `resources/js/components/retro/survey-card.tsx`, add `import { SurveyDiscussion } from './survey-discussion';` and render `<SurveyDiscussion survey={survey} />` as the last child of the `<article>`, after the responses/withdraw row.

- [ ] **Step 3: Translations**

| key | fr | es | de |
|---|---|---|---|
| Answer to join the discussion | Répondez pour rejoindre la discussion | Responde para unirte a la conversación | Antworte, um an der Diskussion teilzunehmen |
| Your name is shown with your comment. | Votre nom est affiché avec votre commentaire. | Tu nombre se muestra con tu comentario. | Dein Name wird mit deinem Kommentar angezeigt. |

- [ ] **Step 4: Check types and lint**

Run: `npx vp fmt resources/js/components/retro/survey-discussion.tsx resources/js/components/retro/survey-card.tsx && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: clean; translation test PASS.

- [ ] **Step 5: Manual check**

Two browsers on a named retro in `Grouping`, one survey. Before answering, the member sees "n comments · Answer to join the discussion" and no chips. The facilitator answers, reacts 🎉 and comments ("Your name is shown with your comment." shows above the composer while "Show who answered" is off). The member's count updates live; after answering, the member sees the chip (no names while the switch is off) and the comment with its author, replies, and the facilitator gets a "New reply in a thread you follow" toast. With reactions turned off in settings, chips disappear. On an anonymous retro, comment authors show as "Anonymous" to others.

- [ ] **Step 6: Commit**

```bash
git add resources/js lang
git commit -m "feat: react to and discuss surveys on the board"
```

---

### Task 10: Verification

- [ ] **Step 1: Backend suite for this plan**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS.

- [ ] **Step 2: Static analysis and formatting**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: clean, 0 errors.

- [ ] **Step 3: Frontend checks and build**

Run: `npm run types:check && npm run check && npm run build`
Expected: clean (pre-existing failures only); build succeeds.

- [ ] **Step 4: Acceptance walkthrough (spec §15, survey part)**

Two browsers, one as a guest (guest link enabled): create a single, a multiple and a free-text survey; results appear in each browser only after answering; close one survey (results appear for the other browser without answering); "Show who answered" shows avatars (and text authors) only once counts are visible and is disabled on an anonymous retro; react and comment (hidden before answering in the other browser); withdraw an answer (results and discussion hide again); complete the retro (every survey closed), reopen it (surveys stay closed, answering refused).

- [ ] **Step 5: Ask for the complete suite**

Ask the user to run `php artisan test --compact` (the whole suite) before merging.

---

## Notes

- Plan 8d renders survey results in the Results view with `PresentSurvey::many()`; Plan 8e adds the "Generate from a prompt" field to `SurveyForm` (it fills the dialog through `setDraft`) and sends closed survey results to the LLM summary.
- `show_voters` alone can be changed while the board is locked (like closing), because it is a facilitator display control rather than board content. Editing, creating and deleting surveys stay blocked by the lock (423).
- `textAnswers` is `null` for choice surveys; it is only a list for free-text surveys whose results the viewer can see.

## Spec coverage

| Spec item | Task |
|---|---|
| §3 `surveys`, `survey_options`, `survey_responses`, `survey_text_answers`, `survey_reactions`, `survey_comments` | 1 |
| §5.1 create/edit/delete: facilitator, `Writing`–`Discussing`, lock 423, ≤ 10 surveys, 2–10 options, 1–100 / 1–200 / ≤ 500 limits, text surveys without options | 3 |
| §5.1 edit refused once answered; `show_voters` changeable any time before `Completed`; anonymous → 422 and never voters | 3, 2 |
| §5.1 answer rules (phases, open, lock), close/reopen (facilitator, not `Completed`, allowed while locked), completion closes all, reopen leaves closed | 4 |
| §5.1 result visibility and ballot secrecy (server-side redaction, broadcasts without voters) | 2, 3, 4 |
| §5.2 per-viewer payload | 2 |
| §5.4 kinds, answer shapes, replace/withdraw, counts and percentages, text answers ordered by text, `authorId` rules, broadcasts without text/option/participant | 1, 2, 4, 8 |
| §5.5 reactions and comments: phases, `Completed` 403, lock 423, `reactions_enabled`, visibility 403, reaction names, comment authors, endpoints, `survey.discussion.changed`, `own-survey-comment.saved`, notifications with `surveyId`, deletion cascade | 2, 3, 5, 9 |
| §5.5 spec 1 generalisation (`SummarizeReactions`, comment presenter, `comment.notification`) | 2, 5, 6, 7 |
| §10.1 survey endpoints; §10.2 `survey.changed`, `survey.deleted`, `survey.discussion.changed`; §10.3 snapshot `surveys`, constant queries | 2–6 |
| §11 surveys, free-text answers, reactions and comments redaction | 2, 5 |
| §13 Surveys column, survey card, facilitator ⋮ menu, "Add survey" dialog with kind selector, option list, "Show who answered" switch and anonymous hint; kinds and discussion UI | 8, 9 |
| §14 rejected mutation → toast + rollback (`ctx.run`), deleted survey → 404 → removed/refetched, wrong answer shape → 422, discussion before visibility → 403 | 4, 5, 6, 8 |
| §15 survey, survey kinds, survey reactions and comments tests; walkthrough survey steps | 1–5, 10 |
| §16 AC 5, 13, 14 | 2–5, 8, 9 |
| §5.3 LLM survey draft; Results view survey section | Plan 8e; Plan 8d |
