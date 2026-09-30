<?php

namespace App\Models;

use App\Enums\IntegrationProvider;
use Database\Factories\ActionItemExternalLinkFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $action_item_id
 * @property IntegrationProvider $source
 * @property string $external_site
 * @property string $external_id
 * @property string $external_key
 * @property string $external_url
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read ActionItem $actionItem
 * @property-read User|null $createdBy
 */
#[Fillable(['source', 'external_site', 'external_id', 'external_key', 'external_url', 'created_by_user_id'])]
class ActionItemExternalLink extends Model
{
    /** @use HasFactory<ActionItemExternalLinkFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<ActionItem, $this> */
    public function actionItem(): BelongsTo
    {
        return $this->belongsTo(ActionItem::class);
    }

    /** @return BelongsTo<User, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    protected function casts(): array
    {
        return [
            'source' => IntegrationProvider::class,
        ];
    }
}
