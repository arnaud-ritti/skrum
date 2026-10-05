<?php

namespace App\Actions\Sessions;

use App\Enums\SessionState;
use App\Models\Team;
use App\Models\User;

class CountLiveTeamSessions
{
    public function __construct(private ListTeamSessions $sessions) {}

    /**
     * ponytail: five counts on every full page visit; cache per team for a few seconds if it shows in a profile.
     */
    public function handle(Team $team, User $viewer): int
    {
        $live = SessionState::Live;

        return $this->sessions->retros($team, $live)->count()
            + $this->sessions->pokerGames($team, $live)->count()
            + $this->sessions->surveys($team, $viewer, $live)->count()
            + $this->sessions->whiteboards($team, $live)->count()
            + $this->sessions->rooms($team, $live)->count();
    }
}
