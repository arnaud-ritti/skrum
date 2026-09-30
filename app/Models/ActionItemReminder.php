<?php

namespace App\Models;

use App\Enums\ActionItemReminderKind;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * One row per reminder sent: an item, its assignee, the kind and the due
 * date it was about. A moved due date or a new assignee needs a new row.
 *
 * @property string $id
 * @property string $action_item_id
 * @property string $user_id
 * @property ActionItemReminderKind $kind
 * @property Carbon $due_on
 * @property Carbon $sent_at
 */
#[Fillable(['action_item_id', 'user_id', 'kind', 'due_on', 'sent_at'])]
class ActionItemReminder extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'kind' => ActionItemReminderKind::class,
            'due_on' => 'date',
            'sent_at' => 'datetime',
        ];
    }
}
