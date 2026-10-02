<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Carries a count and no content: the open page reads the list itself,
 * through the route that checks what its user may see.
 */
class NotificationReceived implements ShouldBroadcast
{
    use Dispatchable;

    public function __construct(public string $userId, public int $unreadCount) {}

    public function broadcastOn(): Channel
    {
        return new PrivateChannel("user.{$this->userId}");
    }

    public function broadcastAs(): string
    {
        return 'notification.received';
    }

    /**
     * @return array{unreadCount: int}
     */
    public function broadcastWith(): array
    {
        return ['unreadCount' => $this->unreadCount];
    }
}
