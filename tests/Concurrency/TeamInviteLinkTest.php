<?php

use App\Actions\Teams\IssueTeamInviteLink;
use App\Actions\Teams\JoinTeamByLink;
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

it('lets every person join when many use the link at the same instant, and counts each once', function () {
    $link = TeamInviteLink::factory()->create();
    $linkId = $link->id;
    $userIds = User::factory()->count(5)->create()->modelKeys();

    $contenders = [];

    foreach ($userIds as $userId) {
        $contenders[] = (static fn (): string => resolve(JoinTeamByLink::class)
            ->handle(TeamInviteLink::query()->findOrFail($linkId), User::query()->findOrFail($userId))->id);
    }

    $outcomes = Race::run($contenders);

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and($link->team->members()->count())->toBe(5)
        ->and($link->team->workspace->members()->count())->toBe(5)
        ->and($link->fresh()->uses_count)->toBe(5);
});

it('counts one use when one account joins twice at the same instant', function () {
    $link = TeamInviteLink::factory()->create();
    $user = User::factory()->create();
    $linkId = $link->id;
    $userId = $user->id;

    $outcomes = Race::run(array_fill(0, 2, static fn (): string => resolve(JoinTeamByLink::class)
        ->handle(TeamInviteLink::query()->findOrFail($linkId), User::query()->findOrFail($userId))->id));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and($link->fresh()->uses_count)->toBe(1)
        ->and($link->team->members()->count())->toBe(1);
});
