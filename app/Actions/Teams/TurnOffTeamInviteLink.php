<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Support\Database\Transactions;
use Illuminate\Support\Facades\DB;

class TurnOffTeamInviteLink
{
    /**
     * The team row is locked as IssueTeamInviteLink locks it, so that a link
     * created at the same instant is turned off too.
     */
    public function handle(Team $team): void
    {
        DB::transaction(function () use ($team): void {
            Team::query()->whereKey($team->id)->lockForUpdate()->first();

            $team->inviteLinks()->whereNull('revoked_at')->update(['revoked_at' => now()]);
        }, Transactions::Attempts);
    }
}
