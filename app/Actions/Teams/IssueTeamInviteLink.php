<?php

namespace App\Actions\Teams;

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Support\Database\Transactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class IssueTeamInviteLink
{
    public function handle(Team $team, User $creator): TeamInviteLink
    {
        return DB::transaction(function () use ($team, $creator): TeamInviteLink {
            Team::query()->whereKey($team->id)->lockForUpdate()->first();

            $team->inviteLinks()->whereNull('revoked_at')->update(['revoked_at' => now()]);

            $token = Str::random(40);

            return $team->inviteLinks()->create([
                'token' => $token,
                'token_hash' => TeamInviteLink::hashToken($token),
                'created_by_id' => $creator->id,
                'team_role' => TeamRole::Member,
                'expires_at' => now()->addDays(TeamInviteLink::ValidForDays),
                'uses_count' => 0,
            ]);
        }, Transactions::Attempts);
    }
}
