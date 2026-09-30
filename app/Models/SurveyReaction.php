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
