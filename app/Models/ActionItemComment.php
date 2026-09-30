<?php

namespace App\Models;

use Database\Factories\ActionItemCommentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $action_item_id
 * @property string|null $author_participant_id
 * @property string|null $author_user_id
 * @property string $content
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read ActionItem $actionItem
 * @property-read Participant|null $authorParticipant
 * @property-read User|null $authorUser
 */
#[Fillable(['author_participant_id', 'author_user_id', 'content'])]
class ActionItemComment extends Model
{
    /** @use HasFactory<ActionItemCommentFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<ActionItem, $this> */
    public function actionItem(): BelongsTo
    {
        return $this->belongsTo(ActionItem::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function authorParticipant(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'author_participant_id');
    }

    /** @return BelongsTo<User, $this> */
    public function authorUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }
}
