<?php

namespace App\Events\Retros;

class VoteRetracted extends RetroBroadcastEvent
{
    /**
     * @param  array{cardId: string, total: int}|null  $cardTotal
     */
    public function __construct(string $retroId, public int $votesCast, public int $votesVersion, public ?array $cardTotal = null)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'vote.retracted';
    }

    public function broadcastWith(): array
    {
        return [
            'votesCast' => $this->votesCast,
            'votesVersion' => $this->votesVersion,
            ...($this->cardTotal ?? []),
        ];
    }
}
