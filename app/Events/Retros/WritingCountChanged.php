<?php

namespace App\Events\Retros;

/**
 * How many people write a card on an anonymous retro. Spec §6.11 rule 4
 * (owner's answer C): the count only — no id, no name, no column.
 */
class WritingCountChanged extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public int $count)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'writing.count';
    }

    public function broadcastWith(): array
    {
        return ['count' => $this->count];
    }
}
