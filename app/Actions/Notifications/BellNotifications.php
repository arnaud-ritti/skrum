<?php

namespace App\Actions\Notifications;

use App\Models\User;
use App\Notifications\RetroResultsNotification;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Notifications\DatabaseNotification;

/**
 * What the bell of a user holds: the list and the unread count read the
 * same rows, so a kind the user turned off is neither listed nor counted.
 */
class BellNotifications
{
    /**
     * @return MorphMany<DatabaseNotification, User>
     */
    public function query(User $user): MorphMany
    {
        $notifications = $user->notifications();

        if ($user->recap_in_app) {
            return $notifications;
        }

        return $notifications->where('type', '!=', RetroResultsNotification::class);
    }

    public function unreadCount(User $user): int
    {
        return $this->query($user)->whereNull('read_at')->count();
    }
}
