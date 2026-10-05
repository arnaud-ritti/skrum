<?php

namespace App\Http\Controllers\Concerns;

use App\Actions\Sessions\ListTeamSessions;
use App\Enums\SessionState;
use App\Models\Team;
use App\Models\User;
use Inertia\Inertia;

trait FlashesLiveSession
{
    /** Right after landing on a team they just joined, a person is offered the team's session in progress, the most recently active one. */
    private function flashLiveSession(?Team $team, User $user): void
    {
        if ($team === null) {
            return;
        }

        if ($user->cannot('view', $team)) {
            return;
        }

        $live = resolve(ListTeamSessions::class)->handle($team, $user, SessionState::Live, null, 1)['sessions'][0] ?? null;

        if ($live === null) {
            return;
        }

        Inertia::flash('liveSession', [
            'kind' => $live['kind'],
            'title' => $live['title'],
            'url' => $live['url'],
        ]);
    }
}
