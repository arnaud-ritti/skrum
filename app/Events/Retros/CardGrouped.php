<?php

namespace App\Events\Retros;

class CardGrouped extends RetroBroadcastEvent
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
        return 'card.grouped';
    }

    public function broadcastWith(): array
    {
        return ['cards' => $this->cards];
    }
}
