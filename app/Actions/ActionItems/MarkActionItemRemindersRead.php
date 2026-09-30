<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Notifications\ActionItemReminderNotification;
use Illuminate\Notifications\DatabaseNotification;

class MarkActionItemRemindersRead
{
    public function handle(ActionItem $item): void
    {
        DatabaseNotification::query()
            ->where('type', ActionItemReminderNotification::class)
            ->whereNull('read_at')
            ->where('data->actionItemId', $item->id)
            ->update(['read_at' => now()]);
    }
}
