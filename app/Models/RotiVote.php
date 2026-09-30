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
