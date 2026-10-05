<?php

namespace App\Events\Games;

use App\Events\BroadcastEvent;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;

/**
 * The live rooms list of a team: summaries only, never a word, a drawing
 * op, a clue or an answer.
 */
abstract class TeamGamesBroadcastEvent extends BroadcastEvent
{
    public function __construct(public string $teamId) {}

    public function broadcastOn(): Channel
    {
        return new PrivateChannel("team-games.{$this->teamId}");
    }
}
