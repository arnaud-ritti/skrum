<?php

use App\Actions\Teams\AnswerTeamAccessRequest;
use App\Enums\TeamAccessRequestStatus;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use Illuminate\Validation\ValidationException;

it('adds the requester to the team on approval', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();

    $status = resolve(AnswerTeamAccessRequest::class)->handle($manager, $request, approve: true);

    expect($status)->toBe(TeamAccessRequestStatus::Approved)
        ->and($team->hasMember($request->user))->toBeTrue()
        ->and($request->fresh()->decided_by_user_id)->toBe($manager->id);
});

it('leaves the team as it is on a decline', function () {
    $team = Team::factory()->create();
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();

    resolve(AnswerTeamAccessRequest::class)->handle(workspaceManager($team->workspace), $request, approve: false);

    expect($team->hasMember($request->user))->toBeFalse()
        ->and($request->fresh()->status)->toBe(TeamAccessRequestStatus::Declined);
});

it('declines instead of adding a requester who left the workspace', function () {
    $team = Team::factory()->create();
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();
    $team->workspace->members()->detach($request->user_id);

    $status = resolve(AnswerTeamAccessRequest::class)->handle(workspaceManager($team->workspace), $request, approve: true);

    expect($status)->toBe(TeamAccessRequestStatus::Declined)->and($team->hasMember($request->user))->toBeFalse();
});

it('refuses to answer twice', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();
    resolve(AnswerTeamAccessRequest::class)->handle($manager, $request, approve: false);

    expect(fn () => resolve(AnswerTeamAccessRequest::class)->handle($manager, $request->fresh(), approve: true))
        ->toThrow(ValidationException::class);
});
