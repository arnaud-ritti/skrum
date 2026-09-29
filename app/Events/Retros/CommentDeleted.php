<?php

namespace App\Events\Retros;

class CommentDeleted extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $cardId, public string $commentId, public bool $soft)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'comment.deleted';
    }

    public function broadcastWith(): array
    {
        return ['cardId' => $this->cardId, 'commentId' => $this->commentId, 'soft' => $this->soft];
    }
}
