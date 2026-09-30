<?php

namespace App\Models;

use Database\Factories\ActionItemSubtaskFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $action_item_id
 * @property string $content
 * @property int $position
 * @property Carbon|null $completed_at
 * @property-read ActionItem $actionItem
 */
#[Fillable(['content', 'position', 'completed_at'])]
class ActionItemSubtask extends Model
{
    /** @use HasFactory<ActionItemSubtaskFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<ActionItem, $this> */
    public function actionItem(): BelongsTo
    {
        return $this->belongsTo(ActionItem::class);
    }

    public function isCompleted(): bool
    {
        return $this->completed_at !== null;
    }

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'completed_at' => 'datetime',
        ];
    }
}
