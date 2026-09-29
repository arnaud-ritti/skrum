<?php

namespace App\Events\Retros;

class CardReactionsChanged extends RetroBroadcastEvent
{
    /**
     * @param  array<int, array{emoji: string, count: int, names: array<int, string>}>  $reactions
     */
    public function __construct(string $retroId, public string $cardId, public array $reactions)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'card.reactions.changed';
    }

    public function broadcastWith(): array
    {
        return ['cardId' => $this->cardId, 'reactions' => $this->reactions];
    }
}
