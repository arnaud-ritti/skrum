<?php

namespace App\Events\Retros;

class CardsMoved extends RetroBroadcastEvent
{
    /**
     * @param  array<int, array<string, mixed>>  $cards
     */
    public function __construct(string $retroId, public array $cards)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'cards.moved';
    }

    public function broadcastWith(): array
    {
        return ['cards' => $this->cards];
    }
}
