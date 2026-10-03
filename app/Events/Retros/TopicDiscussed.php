<?php

namespace App\Events\Retros;

class TopicDiscussed extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $cardId, public ?string $discussedAt)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'topic.discussed';
    }

    public function broadcastWith(): array
    {
        return ['cardId' => $this->cardId, 'discussedAt' => $this->discussedAt];
    }
}
