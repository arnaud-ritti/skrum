<?php

namespace App\Events\Retros;

class CardUpdated extends RetroBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $card
     */
    public function __construct(string $retroId, public array $card)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'card.updated';
    }

    public function broadcastWith(): array
    {
        return ['card' => $this->card];
    }
}
