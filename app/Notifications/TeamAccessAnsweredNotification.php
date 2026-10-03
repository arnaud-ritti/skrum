<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * Tells the requester, in the bell, whether they were added to the team.
 * It stores the request id only; the outcome is read live.
 */
class TeamAccessAnsweredNotification extends Notification
{
    public const string Kind = 'access_answered';

    public function __construct(public string $requestId) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{
     *     kind: string,
     *     requestId: string
     * }
     */
    public function toArray(object $notifiable): array
    {
        return ['kind' => self::Kind, 'requestId' => $this->requestId];
    }
}
