<?php

namespace App\Events\Retros;

class RotiChanged extends RetroBroadcastEvent
{
    /**
     * @param  array<int, string>  $voterIds
     */
    public function __construct(string $retroId, public int $respondents, public array $voterIds)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'roti.changed';
    }

    public function broadcastWith(): array
    {
        return ['respondents' => $this->respondents, 'voterIds' => $this->voterIds];
    }
}
