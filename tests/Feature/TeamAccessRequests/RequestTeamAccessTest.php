<?php

use App\Actions\Teams\AccessRequestRecipients;
use App\Actions\Teams\RequestTeamAccess;
use App\Enums\TeamAccessRequestStatus;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\User;
use Illuminate\Validation\ValidationException;

it('creates one pending request with the message', function () {
    $team = Team::factory()->create();
    $nadia = workspaceMember($team->workspace);

    $request = resolve(RequestTeamAccess::class)->handle($nadia, $team, "  I'm covering for Théo.  ");

    expect($request->status)->toBe(TeamAccessRequestStatus::Pending)
        ->and($request->message)->toBe("I'm covering for Théo.")
        ->and(TeamAccessRequest::query()->count())->toBe(1);
});

it('returns the pending request instead of a second one', function () {
    $team = Team::factory()->create();
    $nadia = workspaceMember($team->workspace);

    $first = resolve(RequestTeamAccess::class)->handle($nadia, $team, null);
    $second = resolve(RequestTeamAccess::class)->handle($nadia, $team, 'Again');

    expect($second->id)->toBe($first->id)->and(TeamAccessRequest::query()->count())->toBe(1);
});

it('refuses a member of the team and a stranger to the workspace', function (Closure $who) {
    $team = Team::factory()->create();

    expect(fn () => resolve(RequestTeamAccess::class)->handle($who($team), $team, null))
        ->toThrow(ValidationException::class);
})->with([
    'member' => [fn (Team $team) => teamMember($team)],
    'stranger' => [fn (Team $team) => User::factory()->create()],
]);

it('sends the request to the owners and admins of the workspace', function () {
    $team = Team::factory()->create();
    $owner = workspaceManager($team->workspace, WorkspaceRole::Owner);
    $admin = workspaceManager($team->workspace, WorkspaceRole::Admin);
    teamMember($team);

    expect(resolve(AccessRequestRecipients::class)->for($team)->pluck('id')->sort()->values()->all())
        ->toBe(collect([$owner->id, $admin->id])->sort()->values()->all());
});
