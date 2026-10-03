<?php

namespace App\Models;

use App\Enums\HealthStatement;
use App\Enums\TeamSurveyQuestionKind;
use Database\Factories\TeamSurveyQuestionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Touches;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $team_survey_id
 * @property TeamSurveyQuestionKind $kind
 * @property string $label
 * @property string|null $short_label
 * @property string|null $description
 * @property HealthStatement|null $builtin
 * @property string|null $match_key
 * @property int $position
 * @property bool $is_required
 * @property bool $allows_comment
 * @property int|null $scale_max
 * @property string|null $scale_min_label
 * @property string|null $scale_max_label
 * @property-read TeamSurvey $survey
 * @property-read Collection<int, TeamSurveyOption> $options
 * @property-read Collection<int, TeamSurveyAnswer> $answers
 */
#[Fillable([
    'kind', 'label', 'short_label', 'description', 'builtin', 'match_key', 'position', 'is_required', 'allows_comment',
    'scale_max', 'scale_min_label', 'scale_max_label',
])]
#[Touches(['survey'])]
class TeamSurveyQuestion extends Model
{
    /** @use HasFactory<TeamSurveyQuestionFactory> */
    use HasFactory;

    use HasUuids;

    public const MinOptions = 2;

    public const MaxOptions = 10;

    /**
     * Every scale created from now on, the builder's and the health check's
     * (`HealthScale::Max`); 10 survives only on imported health checks that
     * hold answers given on ten.
     */
    public const BuilderScaleMax = 5;

    /** @return BelongsTo<TeamSurvey, $this> */
    public function survey(): BelongsTo
    {
        return $this->belongsTo(TeamSurvey::class, 'team_survey_id');
    }

    /** @return HasMany<TeamSurveyOption, $this> */
    public function options(): HasMany
    {
        return $this->hasMany(TeamSurveyOption::class)->orderBy('position')->orderBy('id');
    }

    /** @return HasMany<TeamSurveyAnswer, $this> */
    public function answers(): HasMany
    {
        return $this->hasMany(TeamSurveyAnswer::class);
    }

    public function displayLabel(): string
    {
        return $this->builtin?->text() ?? $this->label;
    }

    public function displayShortLabel(): ?string
    {
        return $this->builtin?->label() ?? $this->short_label;
    }

    protected function casts(): array
    {
        return [
            'kind' => TeamSurveyQuestionKind::class,
            'builtin' => HealthStatement::class,
            'position' => 'integer',
            'is_required' => 'boolean',
            'allows_comment' => 'boolean',
            'scale_max' => 'integer',
        ];
    }
}
