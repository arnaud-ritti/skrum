<?php

namespace App\Events\Retros;

use Illuminate\Broadcasting\PrivateChannel;

class CommentNotification extends RetroBroadcastEvent
{
    /**
     * @param  array{cardId?: string, surveyId?: string, commentId: string, threadId: string, excerpt: string, authorName?: string}  $notification
     */
    public function __construct(string $retroId, public string $participantId, public array $notification)
    {
        parent::__construct($retroId);
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("participant.{$this->participantId}");
    }

    public function broadcastAs(): string
    {
        return 'comment.notification';
    }

    public function broadcastWith(): array
    {
        return $this->notification;
    }
}
