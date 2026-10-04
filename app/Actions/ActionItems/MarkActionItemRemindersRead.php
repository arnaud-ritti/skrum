<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use App\Models\User;
use App\Notifications\ActionItemReminderNotification;
use Illuminate\Notifications\DatabaseNotification;

class MarkActionItemRemindersRead
{
    /**
     * Every reminder is logged before it is sent, so the log names its recipients: the search
     * stays on their notifications, through the notifiable index, instead of the whole table.
     */
    public function handle(ActionItem $item): void
    {
        $recipientIds = ActionItemReminder::query()
            ->where('action_item_id', $item->id)
            ->pluck('user_id')
            ->push($item->assignee_user_id)
            ->filter()
            ->unique()
            ->values();

        DatabaseNotification::query()
            ->where('notifiable_type', new User()->getMorphClass())
            ->whereIn('notifiable_id', $recipientIds)
            ->whereNull('read_at')
            ->where('type', ActionItemReminderNotification::class)
            ->where('data->actionItemId', $item->id)
            ->update(['read_at' => now()]);
    }
}
