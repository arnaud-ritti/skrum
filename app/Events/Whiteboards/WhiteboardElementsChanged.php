<?php

namespace App\Events\Whiteboards;

class WhiteboardElementsChanged extends WhiteboardBroadcastEvent
{
    /**
     * @param  array<int, array<string, mixed>>|null  $elements  null when the payload would exceed one message; clients then fetch the delta
     */
    public function __construct(string $boardId, public int $seq, public int $fromSeq, public ?array $elements)
    {
        parent::__construct($boardId);
    }

    public function broadcastAs(): string
    {
        return 'elements.changed';
    }

    public function broadcastWith(): array
    {
        $payload = ['seq' => $this->seq, 'fromSeq' => $this->fromSeq];

        if ($this->elements === null) {
            return $payload;
        }

        return [...$payload, 'elements' => $this->elements];
    }
}
