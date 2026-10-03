<?php

use App\Actions\Teams\IssueTeamInviteLink;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('leaves one usable link when two are created at the same instant', function () {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);
    $teamId = $team->id;
    $inviterId = $inviter->id;

    $outcomes = Race::run(array_fill(0, 2, static fn (): string => resolve(IssueTeamInviteLink::class)->handle(
        Team::query()->findOrFail($teamId),
        User::query()->findOrFail($inviterId),
    )->id));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(TeamInviteLink::query()->where('team_id', $teamId)->whereNull('revoked_at')->count())->toBe(1);
});
