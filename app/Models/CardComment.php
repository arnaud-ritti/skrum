<?php

namespace App\Models;

use Database\Factories\CardCommentFactory;
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
 * @property string $card_id
 * @property string $participant_id
 * @property string|null $parent_comment_id
 * @property string|null $content
 * @property Carbon|null $deleted_at
 * @property Carbon $created_at
 * @property-read Participant $participant
 * @property-read Card $card
 */
#[Fillable(['retro_id', 'card_id', 'participant_id', 'parent_comment_id', 'content', 'deleted_at'])]
class CardComment extends Model
{
    /** @use HasFactory<CardCommentFactory> */
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

    /** @return HasMany<CardComment, $this> */
    public function replies(): HasMany
    {
        return $this->hasMany(CardComment::class, 'parent_comment_id')->oldest();
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
