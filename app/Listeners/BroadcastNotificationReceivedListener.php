<?php

namespace App\Listeners;

use App\Events\NotificationReceived;
use App\Models\User;
use Illuminate\Notifications\Events\NotificationSent;

class BroadcastNotificationReceivedListener
{
    public function handle(NotificationSent $event): void
    {
        if ($event->channel !== 'database') {
            return;
        }

        if (! $event->notifiable instanceof User) {
            return;
        }

        NotificationReceived::dispatch($event->notifiable->id, $event->notifiable->unreadNotifications()->count());
    }
}
