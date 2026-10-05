<?php

namespace App\Models;

use App\Concerns\HasSearchColumns;
use App\Enums\CardSentiment;
use Database\Factories\CardFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $column_id
 * @property string $participant_id
 * @property string|null $content
 * @property string|null $gif_id
 * @property int $position
 * @property string|null $parent_card_id
 * @property string|null $group_name
 * @property CardSentiment|null $sentiment
 * @property string|null $category
 * @property Carbon|null $discussed_at
 * @property-read Participant $participant
 */
#[Fillable(['column_id', 'participant_id', 'content', 'gif_id', 'position', 'parent_card_id', 'group_name', 'discussed_at'])]
class Card extends Model
{
    /** @use HasFactory<CardFactory> */
    use HasFactory;

    use HasSearchColumns;
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

    /** @return HasMany<CardComment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(CardComment::class)->oldest();
    }

    /** @return HasOne<TopicNote, $this> */
    public function note(): HasOne
    {
        return $this->hasOne(TopicNote::class);
    }

    public function clearGroupNameWhenEmpty(): bool
    {
        if ($this->group_name === null) {
            return false;
        }

        if ($this->children()->exists()) {
            return false;
        }

        $this->update(['group_name' => null]);

        return true;
    }

    public static function nextTopLevelPosition(string $columnId): int
    {
        $lastPosition = self::query()->where('column_id', $columnId)->whereNull('parent_card_id')->max('position');

        return $lastPosition === null ? 0 : $lastPosition + 1;
    }

    public function isTopLevel(): bool
    {
        return $this->parent_card_id === null;
    }

    /** @return array<string, string> */
    public function searchColumns(): array
    {
        return ['content' => 'content_search'];
    }

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'sentiment' => CardSentiment::class,
            'discussed_at' => 'datetime',
        ];
    }
}
