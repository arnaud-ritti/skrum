<?php

namespace App\Listeners;

use App\Events\NotificationReceived;
use App\Models\User;
use Illuminate\Notifications\Events\NotificationSent;

class BroadcastNotificationReceivedListener
{
    /**
     * The live arrival is a courtesy: the notification is stored already,
     * and a broadcaster or a queue that is down must not fail its sender.
     */
    public function handle(NotificationSent $event): void
    {
        if ($event->channel !== 'database') {
            return;
        }

        if (! $event->notifiable instanceof User) {
            return;
        }

        $user = $event->notifiable;

        rescue(fn () => NotificationReceived::dispatch($user->id, $user->unreadNotifications()->count()), report: true);
    }
}
