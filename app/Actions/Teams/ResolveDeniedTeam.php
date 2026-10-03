<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class ResolveDeniedTeam
{
    /**
     * The route parameters of the team sessions: retro, poker game, whiteboard, team survey, game room.
     *
     * @var array<int, string>
     */
    private const array SessionParameters = ['retro', 'game', 'board', 'teamSurvey', 'room'];

    /**
     * The team a signed-in member of its workspace was refused, or null: nothing is said to anyone else.
     */
    public function handle(Request $request): ?Team
    {
        $user = $request->user();
        $team = $this->teamOf($request);

        if (! $user instanceof User || $team === null) {
            return null;
        }

        if (! $user->belongsToWorkspace($team->workspace)) {
            return null;
        }

        return $team->hasMember($user) ? null : $team;
    }

    private function teamOf(Request $request): ?Team
    {
        $route = $request->route();

        if (! is_object($route)) {
            return null;
        }

        $team = $route->parameter('team');

        if ($team instanceof Team) {
            return $team;
        }

        foreach (self::SessionParameters as $name) {
            $session = $route->parameter($name);

            if ($session instanceof Model && $session->getAttribute('team_id') !== null) {
                return Team::query()->whereKey($session->getAttribute('team_id'))->first();
            }
        }

        return null;
    }
}
