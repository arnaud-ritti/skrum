<?php

namespace App\Events\Retros;

class ColumnsChanged extends RetroBroadcastEvent
{
    /**
     * @param  array<int, array<string, mixed>>  $columns
     */
    public function __construct(string $retroId, public array $columns)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'columns.changed';
    }

    public function broadcastWith(): array
    {
        return ['columns' => $this->columns];
    }
}
