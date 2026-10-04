<?php

namespace App\Listeners;

use App\Actions\Notifications\BellNotifications;
use App\Events\NotificationReceived;
use App\Models\User;
use Illuminate\Notifications\Events\NotificationSent;

class BroadcastNotificationReceivedListener
{
    public function __construct(private BellNotifications $bellNotifications) {}

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

        rescue(fn () => event(new NotificationReceived($user->id, $this->bellNotifications->unreadCount($user))), report: true);
    }
}
