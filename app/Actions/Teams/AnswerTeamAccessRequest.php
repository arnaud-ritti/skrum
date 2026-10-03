<?php

namespace App\Actions\Teams;

use App\Enums\TeamAccessRequestStatus;
use App\Enums\TeamActivityKind;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\User;
use App\Support\Database\Transactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AnswerTeamAccessRequest
{
    public function __construct(private RecordTeamActivity $recordTeamActivity) {}

    /**
     * An approval of someone who has left the workspace since asking declines the request instead.
     */
    public function handle(User $manager, TeamAccessRequest $request, bool $approve): TeamAccessRequestStatus
    {
        return DB::transaction(function () use ($manager, $request, $approve): TeamAccessRequestStatus {
            $team = Team::query()->whereKey($request->team_id)->lockForUpdate()->firstOrFail();
            $locked = TeamAccessRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== TeamAccessRequestStatus::Pending) {
                throw ValidationException::withMessages(['request' => __('This request was already answered.')]);
            }

            $canJoin = $approve && $locked->user->belongsToWorkspace($team->workspace);

            $status = $canJoin
                ? TeamAccessRequestStatus::Approved
                : TeamAccessRequestStatus::Declined;

            if ($canJoin) {
                $this->addToTeam($team, $locked->user);
            }

            $locked->update(['status' => $status, 'decided_by_user_id' => $manager->id, 'decided_at' => now()]);

            return $status;
        }, Transactions::Attempts);
    }

    private function addToTeam(Team $team, User $user): void
    {
        $changes = $team->members()->syncWithoutDetaching([$user->id]);

        if ($changes['attached'] === []) {
            return;
        }

        $this->recordTeamActivity->handle($team->id, TeamActivityKind::MemberJoined, $user);
    }
}
