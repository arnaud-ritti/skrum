<?php

namespace App\Events\Retros;

class CardDeleted extends RetroBroadcastEvent
{
    /**
     * @param  array<int, array<string, mixed>>  $ungroupedCards
     */
    public function __construct(string $retroId, public string $cardId, public array $ungroupedCards, public int $writersCount)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'card.deleted';
    }

    public function broadcastWith(): array
    {
        return ['cardId' => $this->cardId, 'ungroupedCards' => $this->ungroupedCards, 'writersCount' => $this->writersCount];
    }
}
