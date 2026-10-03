<?php

namespace App\Events\Retros;

class TopicNoteSaved extends RetroBroadcastEvent
{
    /**
     * @param  array{cardId: string, body: string, version: int, updatedAt: ?string}  $note
     */
    public function __construct(string $retroId, public array $note)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'topic.note.saved';
    }

    public function broadcastWith(): array
    {
        return ['note' => $this->note];
    }
}
