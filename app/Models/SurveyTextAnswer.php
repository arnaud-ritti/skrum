<?php

namespace App\Models;

use Database\Factories\SurveyTextAnswerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

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

    public function newUniqueId(): string
    {
        return (string) Str::uuid();
    }

    /** @return BelongsTo<Survey, $this> */
    public function survey(): BelongsTo
    {
        return $this->belongsTo(Survey::class);
    }
}
