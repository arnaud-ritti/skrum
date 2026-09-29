<?php

namespace App\Events\Retros;

class CommentUpdated extends RetroBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $comment
     */
    public function __construct(string $retroId, public array $comment)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'comment.updated';
    }

    public function broadcastWith(): array
    {
        return ['comment' => $this->comment];
    }
}
