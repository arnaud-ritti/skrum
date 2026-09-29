<?php

namespace App\Events\Retros;

class CommentCreated extends RetroBroadcastEvent
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
        return 'comment.created';
    }

    public function broadcastWith(): array
    {
        return ['comment' => $this->comment];
    }
}
