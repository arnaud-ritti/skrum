<?php

namespace App\Events\Retros;

class ActionItemSaved extends RetroBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $actionItem
     */
    public function __construct(string $retroId, public array $actionItem)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'action-item.saved';
    }

    public function broadcastWith(): array
    {
        return ['actionItem' => $this->actionItem];
    }
}
