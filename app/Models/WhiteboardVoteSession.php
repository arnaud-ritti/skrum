<?php

namespace App\Models;

use Database\Factories\WhiteboardVoteSessionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $whiteboard_id
 * @property int $votes_per_member
 * @property string|null $frame_element_id
 * @property bool $allow_multiple
 * @property list<string> $element_ids
 * @property string|null $opened_by_member_id
 * @property Carbon|null $closed_at
 * @property Carbon|null $dismissed_at
 * @property list<array{elementId: string, text: string, count: int}>|null $results
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Whiteboard $whiteboard
 */
#[Fillable(['whiteboard_id', 'votes_per_member', 'frame_element_id', 'allow_multiple', 'element_ids', 'opened_by_member_id', 'closed_at', 'dismissed_at', 'results'])]
class WhiteboardVoteSession extends Model
{
    /** @use HasFactory<WhiteboardVoteSessionFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Whiteboard, $this> */
    public function whiteboard(): BelongsTo
    {
        return $this->belongsTo(Whiteboard::class);
    }

    /** @return HasMany<WhiteboardVote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(WhiteboardVote::class);
    }

    public function isOpen(): bool
    {
        return $this->closed_at === null;
    }

    /**
     * In scope: a live sticky note the vote was opened on (spec §11.4).
     */
    public function isTarget(?WhiteboardElement $element): bool
    {
        if ($element === null || $element->is_deleted || ! $element->is_sticky) {
            return false;
        }

        return in_array($element->element_id, $this->element_ids, true);
    }

    protected function casts(): array
    {
        return [
            'votes_per_member' => 'integer',
            'allow_multiple' => 'boolean',
            'element_ids' => 'array',
            'results' => 'array',
            'closed_at' => 'datetime',
            'dismissed_at' => 'datetime',
        ];
    }
}
