<?php

namespace App\Events\Retros;

class CardHighlighted extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public ?string $cardId)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'card.highlighted';
    }

    public function broadcastWith(): array
    {
        return ['cardId' => $this->cardId];
    }
}
