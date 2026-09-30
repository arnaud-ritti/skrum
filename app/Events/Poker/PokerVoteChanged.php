<?php

namespace App\Events\Poker;

class PokerVoteChanged extends PokerBroadcastEvent
{
    public function __construct(
        string $gameId,
        public string $roundId,
        public string $playerId,
        public bool $hasVoted,
        public int $votesCount,
        public int $version,
    ) {
        parent::__construct($gameId);
    }

    public function broadcastAs(): string
    {
        return 'vote.changed';
    }

    public function broadcastWith(): array
    {
        return [
            'roundId' => $this->roundId,
            'playerId' => $this->playerId,
            'hasVoted' => $this->hasVoted,
            'votesCount' => $this->votesCount,
            'version' => $this->version,
        ];
    }
}
