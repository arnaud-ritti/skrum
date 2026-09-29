<?php

namespace App\Models;

use Database\Factories\CardFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $column_id
 * @property string $participant_id
 * @property string $content
 * @property int $position
 * @property string|null $parent_card_id
 * @property-read Participant $participant
 */
#[Fillable(['column_id', 'participant_id', 'content', 'position', 'parent_card_id'])]
class Card extends Model
{
    /** @use HasFactory<CardFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<Column, $this> */
    public function column(): BelongsTo
    {
        return $this->belongsTo(Column::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    /** @return BelongsTo<Card, $this> */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Card::class, 'parent_card_id');
    }

    /** @return HasMany<Card, $this> */
    public function children(): HasMany
    {
        return $this->hasMany(Card::class, 'parent_card_id');
    }

    /** @return HasMany<Vote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }

    /** @return HasMany<CardReaction, $this> */
    public function reactions(): HasMany
    {
        return $this->hasMany(CardReaction::class)->oldest();
    }

    public function isTopLevel(): bool
    {
        return $this->parent_card_id === null;
    }

    protected function casts(): array
    {
        return [
            'position' => 'integer',
        ];
    }
}
