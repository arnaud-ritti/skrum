<?php

namespace App\Models;

use Database\Factories\CardReactionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $card_id
 * @property string $participant_id
 * @property string $emoji
 * @property-read Participant $participant
 */
#[Fillable(['retro_id', 'card_id', 'participant_id', 'emoji'])]
class CardReaction extends Model
{
    /** @use HasFactory<CardReactionFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Card, $this> */
    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }
}
