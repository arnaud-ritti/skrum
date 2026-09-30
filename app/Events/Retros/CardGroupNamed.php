<?php

namespace App\Events\Retros;

class CardGroupNamed extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $cardId, public ?string $groupName)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'card.group-named';
    }

    public function broadcastWith(): array
    {
        return ['cardId' => $this->cardId, 'groupName' => $this->groupName];
    }
}
