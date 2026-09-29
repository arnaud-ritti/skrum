<?php

namespace App\Events\Retros;

use Illuminate\Broadcasting\PrivateChannel;

class OwnCardSaved extends RetroBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $card
     */
    public function __construct(string $retroId, public string $participantId, public array $card)
    {
        parent::__construct($retroId);
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("participant.{$this->participantId}");
    }

    public function broadcastAs(): string
    {
        return 'own-card.saved';
    }

    public function broadcastWith(): array
    {
        return ['card' => $this->card];
    }
}
