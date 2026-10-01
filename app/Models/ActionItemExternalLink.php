<?php

namespace App\Models;

use App\Enums\ExternalIssueState;
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
 * @property ExternalIssueState|null $external_state
 * @property string|null $external_status_name
 * @property Carbon|null $external_updated_at
 * @property Carbon|null $local_state_changed_at
 * @property ExternalIssueState|null $last_pushed_state
 * @property Carbon|null $last_pushed_at
 * @property Carbon|null $last_synced_at
 * @property string|null $sync_error
 * @property Carbon|null $missing_at
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
            'external_state' => ExternalIssueState::class,
            'last_pushed_state' => ExternalIssueState::class,
            'external_updated_at' => 'datetime',
            'local_state_changed_at' => 'datetime',
            'last_pushed_at' => 'datetime',
            'last_synced_at' => 'datetime',
            'missing_at' => 'datetime',
        ];
    }
}
