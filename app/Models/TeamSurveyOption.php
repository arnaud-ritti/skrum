<?php

namespace App\Models;

use Database\Factories\TeamSurveyOptionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Touches;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $team_survey_question_id
 * @property string $label
 * @property int $position
 */
#[Fillable(['label', 'position'])]
#[Touches(['question'])]
class TeamSurveyOption extends Model
{
    /** @use HasFactory<TeamSurveyOptionFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<TeamSurveyQuestion, $this> */
    public function question(): BelongsTo
    {
        return $this->belongsTo(TeamSurveyQuestion::class, 'team_survey_question_id');
    }

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }
}
