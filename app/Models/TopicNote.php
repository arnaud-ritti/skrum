<?php

namespace App\Models;

use Database\Factories\TopicNoteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $card_id
 * @property string $body
 * @property int $version
 * @property string|null $updated_by_participant_id
 * @property Carbon|null $updated_at
 */
#[Fillable(['card_id', 'body', 'version', 'updated_by_participant_id'])]
class TopicNote extends Model
{
    /** @use HasFactory<TopicNoteFactory> */
    use HasFactory;

    use HasUuids;

    public const int MaxLength = 5000;

    /** @var array<string, mixed> */
    protected $attributes = ['body' => '', 'version' => 0];

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<Card, $this> */
    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'updated_by_participant_id');
    }

    protected function casts(): array
    {
        return ['version' => 'integer'];
    }
}
