<?php

namespace App\Events\Retros;

class CarriedActionItemSaved extends RetroMembersBroadcastEvent
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
        return 'carried-action-item.saved';
    }

    public function broadcastWith(): array
    {
        return ['actionItem' => $this->actionItem];
    }
}
