<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * Asks a manager, in the bell, to add someone to a team. It stores the
 * request id only: the bell reads the request live, and drops it once
 * the reader can no longer manage the team. Sent now, not queued, so it
 * is in the bell before the requester's answer comes back.
 */
class TeamAccessRequestedNotification extends Notification
{
    public const string Kind = 'access_request';

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
