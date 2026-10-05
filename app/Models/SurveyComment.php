<?php

namespace App\Models;

use App\Concerns\IsThreadedComment;
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
    use IsThreadedComment;

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

    protected function casts(): array
    {
        return ['deleted_at' => 'datetime'];
    }
}
