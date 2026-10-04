<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Testing\TestResponse;

function requestAccess(mixed $test, User $user, Team $team, ?string $message = null): TestResponse
{
    return $test->actingAs($user)->postJson(
        route('teams.accessRequests.store', [$team->workspace, $team]),
        ['message' => $message],
    );
}

it('notifies every manager in the bell and answers pending', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $manager = workspaceManager($team->workspace);
    $nadia = User::factory()->create(['name' => 'Nadia']);
    $team->workspace->members()->attach($nadia, ['role' => WorkspaceRole::Member->value]);

    requestAccess($this, $nadia, $team, "I'm covering for Théo.")->assertCreated()->assertJson(['status' => 'pending']);

    $this->actingAs($manager)->getJson(route('notifications.index'))
        ->assertJsonPath('notifications.0.kind', 'access_request')
        ->assertJsonPath('notifications.0.team', 'Atlas')
        ->assertJsonPath('notifications.0.actor.name', 'Nadia')
        ->assertJsonPath('notifications.0.excerpt', "I'm covering for Théo.")
        ->assertJsonPath('notifications.0.request.status', 'pending');
});

it('refuses a sixth request within an hour', function () {
    $workspace = Workspace::factory()->create();
    $teams = Team::factory()->count(6)->for($workspace)->create();
    $user = User::factory()->create();
    $workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);

    foreach ($teams->take(5) as $team) {
        requestAccess($this, $user, $team)->assertCreated();
    }

    requestAccess($this, $user, $teams->last())->assertTooManyRequests();
});

it('lets a manager approve, then tells the requester', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $manager = workspaceManager($team->workspace);
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();

    $this->actingAs($manager)
        ->patchJson(route('teams.accessRequests.update', [$team->workspace, $team, $request]), ['decision' => 'approve'])
        ->assertOk()->assertJson(['status' => 'approved']);

    $this->actingAs($request->user)->getJson(route('notifications.index'))
        ->assertJsonPath('notifications.0.kind', 'access_answered')
        ->assertJsonPath('notifications.0.outcome', 'approved')
        ->assertJsonPath('notifications.0.href', route('teams.show', [$team->workspace, $team]));
});

it('refuses an answer from someone who cannot manage the team', function () {
    $team = Team::factory()->create();
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();

    $this->actingAs(teamMember($team))
        ->patchJson(route('teams.accessRequests.update', [$team->workspace, $team, $request]), ['decision' => 'approve'])
        ->assertForbidden();
});

it('answers 422 to a second answer', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();
    $url = route('teams.accessRequests.update', [$team->workspace, $team, $request]);

    $this->actingAs($manager)->patchJson($url, ['decision' => 'decline'])->assertOk();
    $this->actingAs($manager)->patchJson($url, ['decision' => 'approve'])->assertUnprocessable();
});

it('drops the request from the bell of a manager who lost the right', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $nadia = User::factory()->create();
    $team->workspace->members()->attach($nadia, ['role' => WorkspaceRole::Member->value]);
    requestAccess($this, $nadia, $team);
    $team->workspace->members()->updateExistingPivot($manager->id, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($manager)->getJson(route('notifications.index'))->assertJsonCount(0, 'notifications');
});

it('notifies the managers once when the same person asks again', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $nadia = User::factory()->create();
    $team->workspace->members()->attach($nadia, ['role' => WorkspaceRole::Member->value]);

    requestAccess($this, $nadia, $team)->assertCreated();
    requestAccess($this, $nadia, $team, 'Again')->assertCreated()->assertJson(['status' => 'pending']);

    $this->actingAs($manager)->getJson(route('notifications.index'))->assertJsonCount(1, 'notifications');
});

it('tells the manager why an approval became a decline and spares the former member the bell', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();
    $team->workspace->members()->detach($request->user_id);

    $this->actingAs($manager)
        ->patchJson(route('teams.accessRequests.update', [$team->workspace, $team, $request]), ['decision' => 'approve'])
        ->assertOk()
        ->assertJson([
            'status' => 'declined',
            'reason' => 'leftWorkspace',
            'message' => __('They have left the workspace, so the request was declined.'),
        ]);

    expect($request->user->notifications()->count())->toBe(0);
});

it('gives no reason for a decline the manager chose after the requester left', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();
    $team->workspace->members()->detach($request->user_id);

    $this->actingAs($manager)
        ->patchJson(route('teams.accessRequests.update', [$team->workspace, $team, $request]), ['decision' => 'decline'])
        ->assertOk()
        ->assertExactJson(['status' => 'declined']);

    expect($request->user->notifications()->count())->toBe(0);
});

it('gives no reason for a decline the manager chose', function () {
    $team = Team::factory()->create();
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();

    $this->actingAs(workspaceManager($team->workspace))
        ->patchJson(route('teams.accessRequests.update', [$team->workspace, $team, $request]), ['decision' => 'decline'])
        ->assertOk()
        ->assertExactJson(['status' => 'declined']);
});
