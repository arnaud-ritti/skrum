<?php

namespace App\Models;

use App\Enums\SuggestedActionStatus;
use Database\Factories\SuggestedActionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $retro_id
 * @property string|null $theme_id
 * @property string $content
 * @property int $position
 * @property SuggestedActionStatus $status
 * @property string|null $action_item_id
 * @property string|null $handled_by_participant_id
 * @property Carbon|null $handled_at
 * @property-read RetroTheme|null $theme
 */
#[Fillable(['theme_id', 'content', 'position', 'status', 'action_item_id', 'handled_by_participant_id', 'handled_at'])]
class SuggestedAction extends Model
{
    /** @use HasFactory<SuggestedActionFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<RetroTheme, $this> */
    public function theme(): BelongsTo
    {
        return $this->belongsTo(RetroTheme::class, 'theme_id');
    }

    /** @return BelongsTo<ActionItem, $this> */
    public function actionItem(): BelongsTo
    {
        return $this->belongsTo(ActionItem::class);
    }

    public function isPending(): bool
    {
        return $this->status === SuggestedActionStatus::Pending;
    }

    protected function casts(): array
    {
        return [
            'status' => SuggestedActionStatus::class,
            'position' => 'integer',
            'handled_at' => 'datetime',
        ];
    }
}
