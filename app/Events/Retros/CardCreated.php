<?php

namespace App\Events\Retros;

class CardCreated extends RetroBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $card
     */
    public function __construct(string $retroId, public array $card, public int $writersCount)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'card.created';
    }

    public function broadcastWith(): array
    {
        return ['card' => $this->card, 'writersCount' => $this->writersCount];
    }
}
