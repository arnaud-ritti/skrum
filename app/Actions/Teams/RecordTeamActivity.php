<?php

namespace App\Actions\Teams;

use App\Enums\TeamActivityKind;
use App\Models\TeamActivity;
use App\Models\User;

class RecordTeamActivity
{
    /**
     * Runs inside the transaction of the change it records, so that both are kept or neither.
     */
    public function handle(string $teamId, TeamActivityKind $kind, ?User $user, ?string $actorName = null, ?string $subjectId = null, ?string $subjectTitle = null): void
    {
        TeamActivity::query()->create([
            'team_id' => $teamId,
            'kind' => $kind,
            'actor_user_id' => $user?->id,
            'actor_name' => $user === null && $actorName !== null ? mb_substr($actorName, 0, 100) : null,
            'subject_id' => $subjectId,
            'subject_title' => $subjectTitle === null ? null : mb_substr($subjectTitle, 0, 200),
        ]);
    }
}
