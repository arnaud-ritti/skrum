<?php

namespace App\Events\Retros;

use Illuminate\Broadcasting\PrivateChannel;

class OwnCommentSaved extends RetroBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $comment
     */
    public function __construct(string $retroId, public string $participantId, public array $comment)
    {
        parent::__construct($retroId);
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("participant.{$this->participantId}");
    }

    public function broadcastAs(): string
    {
        return 'own-comment.saved';
    }

    public function broadcastWith(): array
    {
        return ['comment' => $this->comment];
    }
}
