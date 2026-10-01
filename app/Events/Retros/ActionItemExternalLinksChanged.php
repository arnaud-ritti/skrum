<?php

namespace App\Events\Retros;

class ActionItemExternalLinksChanged extends RetroMembersBroadcastEvent
{
    /**
     * @param  array<int, array<string, mixed>>  $externalLinks
     */
    public function __construct(string $retroId, public string $actionItemId, public array $externalLinks)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'action-item.external-links.changed';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId, 'externalLinks' => $this->externalLinks];
    }
}
