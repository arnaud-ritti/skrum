<?php

namespace App\Events\Retros;

class HealthAnswered extends RetroBroadcastEvent
{
    /**
     * @param  array<int, array{key: string, count: int, answeredBy: array<int, string>}>  $statements
     */
    public function __construct(string $retroId, public array $statements)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'health.answered';
    }

    public function broadcastWith(): array
    {
        return ['statements' => $this->statements];
    }
}
