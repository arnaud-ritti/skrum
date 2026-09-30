<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use App\Notifications\ActionItemReminderNotification;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Notifications\DatabaseNotification;

class PruneActionItemNotifications
{
    /**
     * @return array{notifications: int, reminders: int}
     */
    public function handle(): array
    {
        $orphaned = $this->deleteOrphanedNotifications();
        $read = DatabaseNotification::query()
            ->whereNotNull('read_at')
            ->where('created_at', '<', now()->subDays(30))
            ->delete();
        $old = DatabaseNotification::query()
            ->where('created_at', '<', now()->subDays(90))
            ->delete();
        $reminders = ActionItemReminder::query()
            ->where('sent_at', '<', now()->subDays(90))
            ->delete();

        return ['notifications' => $orphaned + $read + $old, 'reminders' => $reminders];
    }

    private function deleteOrphanedNotifications(): int
    {
        $deleted = 0;

        DatabaseNotification::query()
            ->where('type', ActionItemReminderNotification::class)
            ->chunkById(500, function (Collection $notifications) use (&$deleted): void {
                $referenced = $notifications
                    ->map(fn (DatabaseNotification $notification) => $notification->data['actionItemId'] ?? null)
                    ->filter()
                    ->unique()
                    ->values();
                $existing = ActionItem::query()->whereKey($referenced)->pluck('id');
                $orphans = $notifications
                    ->reject(fn (DatabaseNotification $notification) => $existing->contains($notification->data['actionItemId'] ?? null))
                    ->modelKeys();

                $deleted += DatabaseNotification::query()->whereKey($orphans)->delete();
            });

        return $deleted;
    }
}
