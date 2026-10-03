<?php

namespace App\Actions\Teams;

use App\Enums\TeamAccessRequestStatus;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\User;
use App\Support\Database\Transactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RequestTeamAccess
{
    public const int MaxMessageLength = 500;

    /**
     * One pending request per person and team: a second one while the first waits returns the first. The lock on the
     * team row serialises two requests made at once.
     */
    public function handle(User $requester, Team $team, ?string $message): TeamAccessRequest
    {
        $message = $message === null ? null : trim($message);

        return DB::transaction(function () use ($requester, $team, $message): TeamAccessRequest {
            $lockedTeam = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            if (! $requester->belongsToWorkspace($lockedTeam->workspace)) {
                throw ValidationException::withMessages(['team' => __('You are not in the workspace of this team.')]);
            }

            if ($lockedTeam->hasMember($requester)) {
                throw ValidationException::withMessages(['team' => __('You are already in this team.')]);
            }

            $pending = TeamAccessRequest::query()
                ->where('team_id', $lockedTeam->id)
                ->where('user_id', $requester->id)
                ->where('status', TeamAccessRequestStatus::Pending)
                ->first();

            if ($pending !== null) {
                return $pending;
            }

            return TeamAccessRequest::query()->create([
                'team_id' => $lockedTeam->id,
                'user_id' => $requester->id,
                'message' => $message === '' ? null : $message,
                'status' => TeamAccessRequestStatus::Pending,
            ]);
        }, Transactions::Attempts);
    }
}
