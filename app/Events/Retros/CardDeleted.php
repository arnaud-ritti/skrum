<?php

namespace App\Events\Retros;

class CardDeleted extends RetroBroadcastEvent
{
    /**
     * @param  array<int, string>  $ungroupedCardIds
     */
    public function __construct(string $retroId, public string $cardId, public array $ungroupedCardIds)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'card.deleted';
    }

    public function broadcastWith(): array
    {
        return ['cardId' => $this->cardId, 'ungroupedCardIds' => $this->ungroupedCardIds];
    }
}
