<?php

namespace App\Models;

use Database\Factories\TeamSurveyAnswerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

/**
 * @property string $id
 * @property string $team_survey_question_id
 * @property string $team_survey_respondent_id
 * @property int|null $value
 * @property string|null $text
 * @property string|null $comment
 * @property-read Collection<int, TeamSurveyOption> $options
 */
#[Fillable(['team_survey_question_id', 'team_survey_respondent_id', 'value', 'text', 'comment'])]
class TeamSurveyAnswer extends Model
{
    /** @use HasFactory<TeamSurveyAnswerFactory> */
    use HasFactory;

    use HasUuids;

    /**
     * Random, so that an id never tells when an answer was written.
     */
    public function newUniqueId(): string
    {
        return (string) Str::uuid();
    }

    /** @return BelongsTo<TeamSurveyQuestion, $this> */
    public function question(): BelongsTo
    {
        return $this->belongsTo(TeamSurveyQuestion::class, 'team_survey_question_id');
    }

    /** @return BelongsTo<TeamSurveyRespondent, $this> */
    public function respondent(): BelongsTo
    {
        return $this->belongsTo(TeamSurveyRespondent::class, 'team_survey_respondent_id');
    }

    /** @return BelongsToMany<TeamSurveyOption, $this> */
    public function options(): BelongsToMany
    {
        return $this->belongsToMany(TeamSurveyOption::class, 'team_survey_answer_options');
    }

    protected function casts(): array
    {
        return ['value' => 'integer'];
    }
}
