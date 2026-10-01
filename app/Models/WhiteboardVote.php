<?php

namespace App\Models;

use Database\Factories\WhiteboardVoteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $whiteboard_vote_session_id
 * @property string $whiteboard_member_id
 * @property string $element_id
 * @property int $count
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['whiteboard_vote_session_id', 'whiteboard_member_id', 'element_id', 'count'])]
class WhiteboardVote extends Model
{
    /** @use HasFactory<WhiteboardVoteFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<WhiteboardVoteSession, $this> */
    public function session(): BelongsTo
    {
        return $this->belongsTo(WhiteboardVoteSession::class, 'whiteboard_vote_session_id');
    }

    /** @return BelongsTo<WhiteboardMember, $this> */
    public function member(): BelongsTo
    {
        return $this->belongsTo(WhiteboardMember::class, 'whiteboard_member_id');
    }

    protected function casts(): array
    {
        return [
            'count' => 'integer',
        ];
    }
}
