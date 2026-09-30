<?php

use App\Enums\RetroPhase;
use App\Events\ActionItems\TeamActionItemCommentsChanged;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Retros\ActionItemSaved;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: Retro, 1: ActionItem, 2: User}
 */
function workspaceBoardItem(RetroPhase $phase = RetroPhase::Completed, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->withGuestAccess()->create($attributes);
    [$author, $participant] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);

    return [$retro, $item, $author];
}

function workspaceActionItemActor(string $role, Retro $retro, ActionItem $item, User $author): User
{
    return match ($role) {
        'author' => $author,
        'facilitator' => retroFacilitator($retro)[0],
        'workspace admin' => workspaceManager($retro->team->workspace),
        'member assignee' => tap(teamMember($retro->team), fn (User $user) => $item->update(['assignee_user_id' => $user->id])),
        'review facilitator' => retroFacilitator(Retro::factory()->create(['team_id' => $retro->team_id]))[0],
        'other member' => teamMember($retro->team),
    };
}

it('lets team members add items outside a retro', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $assignee = teamMember($team);

    $id = $this->actingAs($user)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), [
            'team_id' => $team->id,
            'content' => 'Book the retro room',
            'priority' => 'low',
            'due_on' => '2026-11-02',
            'assignee_user_id' => $assignee->id,
            'theme_name' => 'Forged',
        ])
        ->assertCreated()
        ->assertJsonPath('actionItem.retroId', null)
        ->assertJsonPath('actionItem.source', null)
        ->assertJsonPath('actionItem.teamId', $team->id)
        ->assertJsonPath('actionItem.createdBy.name', $user->name)
        ->assertJsonPath('actionItem.assignee.id', $assignee->id)
        ->assertJsonPath('actionItem.isMine', true)
        ->json('actionItem.id');

    expect(ActionItem::find($id)->only(['created_by_user_id', 'created_by_participant_id', 'theme_name']))->toBe([
        'created_by_user_id' => $user->id,
        'created_by_participant_id' => null,
        'theme_name' => null,
    ]);
    Event::assertDispatched(TeamActionItemSaved::class, fn (TeamActionItemSaved $event) => $event->teamId === $team->id);
    Event::assertNotDispatched(ActionItemSaved::class);
});

it('refuses teams of other workspaces, unknown teams and teams the viewer cannot see', function (Closure $teamId) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), ['team_id' => $teamId($team), 'content' => 'Nope'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('team_id');
})->with([
    'other workspace' => [fn (Team $team) => Team::factory()->create()->id],
    'unknown team' => [fn (Team $team) => '00000000-0000-4000-8000-000000000000'],
    'invisible team' => [fn (Team $team) => Team::factory()->create(['workspace_id' => $team->workspace_id])->id],
]);

it('refuses workspace admins who are not in the team', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);

    $this->actingAs($admin)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), ['team_id' => $team->id, 'content' => 'Nope'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Only team members can add action items to this team.');
});

it('assigns only team members from the workspace', function (Closure $payload, string $field) {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $retro = Retro::factory()->withGuestAccess()->create(['team_id' => $team->id]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), ['team_id' => $team->id, 'content' => 'Assign', ...$payload($guest, $team)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'a guest' => [fn (Participant $guest, Team $team) => ['assignee_participant_id' => $guest->id], 'assignee_participant_id'],
    'an admin outside the team' => [fn (Participant $guest, Team $team) => ['assignee_user_id' => workspaceManager($team->workspace)->id], 'assignee_user_id'],
]);

it('applies the permission matrix on the workspace', function (string $role, string $action, int $status) {
    [$retro, $item, $author] = workspaceBoardItem();
    $user = workspaceActionItemActor($role, $retro, $item, $author);
    $params = ['workspace' => $retro->team->workspace, 'actionItem' => $item];

    $response = match ($action) {
        'edit' => $this->actingAs($user)->patchJson(route('workspaces.actionItems.update', $params), ['content' => 'Changed']),
        'complete' => $this->actingAs($user)->patchJson(route('workspaces.actionItems.update', $params), ['status' => 'completed']),
        'delete' => $this->actingAs($user)->deleteJson(route('workspaces.actionItems.destroy', $params)),
    };

    $response->assertStatus($status);
})->with(function () {
    $matrix = [
        'author' => ['edit' => 200, 'complete' => 200, 'delete' => 204],
        'facilitator' => ['edit' => 200, 'complete' => 200, 'delete' => 204],
        'workspace admin' => ['edit' => 200, 'complete' => 200, 'delete' => 204],
        'member assignee' => ['edit' => 403, 'complete' => 200, 'delete' => 403],
        'review facilitator' => ['edit' => 403, 'complete' => 200, 'delete' => 403],
        'other member' => ['edit' => 403, 'complete' => 403, 'delete' => 403],
    ];

    foreach ($matrix as $role => $actions) {
        foreach ($actions as $action => $status) {
            yield "{$role} may {$action}: {$status}" => [$role, $action, $status];
        }
    }
});

it('manages items added outside a retro', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $other = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $author)->create();
    [$reviewer] = retroFacilitator(Retro::factory()->create(['team_id' => $team->id]));
    $params = ['workspace' => $team->workspace, 'actionItem' => $item];

    $this->actingAs($other)->patchJson(route('workspaces.actionItems.update', $params), ['content' => 'Mine now'])->assertForbidden();
    $this->actingAs($author)->patchJson(route('workspaces.actionItems.update', $params), ['content' => 'Reworded'])->assertOk();
    $this->actingAs($reviewer)->patchJson(route('workspaces.actionItems.update', $params), ['status' => 'completed'])->assertOk();
    $this->actingAs(workspaceManager($team->workspace))->deleteJson(route('workspaces.actionItems.destroy', $params))->assertNoContent();
});

it('changes items in every phase from the workspace', function (RetroPhase $phase) {
    [$retro, $item, $author] = workspaceBoardItem($phase);

    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $retro->team->workspace, 'actionItem' => $item]), ['priority' => 'high'])
        ->assertOk()
        ->assertJsonPath('actionItem.priority', 'high');
})->with([RetroPhase::Writing, RetroPhase::Voting, RetroPhase::Discussing, RetroPhase::Completed]);

it('returns 423 only for locked retros that are still running', function () {
    [$running, $runningItem, $runningAuthor] = workspaceBoardItem(RetroPhase::Voting, ['is_locked' => true]);
    [$finished, $finishedItem, $finishedAuthor] = workspaceBoardItem(RetroPhase::Completed, ['is_locked' => true]);
    $team = Team::factory()->create();
    $teamAuthor = teamMember($team);
    $teamItem = ActionItem::factory()->withoutRetro($team, $teamAuthor)->create();

    $this->actingAs($runningAuthor)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $running->team->workspace, 'actionItem' => $runningItem]), ['status' => 'completed'])
        ->assertStatus(423);
    $this->actingAs($runningAuthor)
        ->postJson(route('workspaces.actionItemComments.store', ['workspace' => $running->team->workspace, 'actionItem' => $runningItem]), ['content' => 'Locked'])
        ->assertStatus(423);
    $this->actingAs($finishedAuthor)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $finished->team->workspace, 'actionItem' => $finishedItem]), ['status' => 'completed'])
        ->assertOk();
    $this->actingAs($teamAuthor)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $team->workspace, 'actionItem' => $teamItem]), ['status' => 'completed'])
        ->assertOk();
});

it('hides items of other workspaces and invisible teams', function () {
    [$retro, $item] = workspaceBoardItem();
    $workspace = $retro->team->workspace;
    $outsider = teamMember(Team::factory()->create(['workspace_id' => $workspace->id]));
    [$foreignRetro, $foreignItem] = workspaceBoardItem();
    $admin = workspaceManager($workspace);

    $this->actingAs($outsider)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $workspace, 'actionItem' => $item]), ['status' => 'completed'])
        ->assertNotFound();
    $this->actingAs($outsider)
        ->getJson(route('workspaces.actionItemComments.index', ['workspace' => $workspace, 'actionItem' => $item]))
        ->assertNotFound();
    $this->actingAs($admin)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $workspace, 'actionItem' => $foreignItem]), ['status' => 'completed'])
        ->assertNotFound();
});

it('keeps guests out of the workspace endpoints', function () {
    [$retro, $item] = workspaceBoardItem(RetroPhase::Discussing);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $retro->team->workspace, 'actionItem' => $item]), ['status' => 'completed'])
        ->assertUnauthorized();
});

it('locks out members who left the team, even as author or assignee', function (string $role) {
    [$retro, $item, $author] = workspaceBoardItem();
    $team = $retro->team;
    $user = $role === 'author' ? $author : tap(teamMember($team), fn (User $member) => $item->update(['assignee_user_id' => $member->id]));
    $comment = ActionItemComment::factory()->create(['action_item_id' => $item->id, 'author_user_id' => $user->id]);
    $team->members()->detach($user->id);
    $params = ['workspace' => $team->workspace, 'actionItem' => $item];

    $this->actingAs($user)->patchJson(route('workspaces.actionItems.update', $params), ['status' => 'completed'])->assertNotFound();
    $this->actingAs($user)->deleteJson(route('workspaces.actionItems.destroy', $params))->assertNotFound();
    $this->actingAs($user)->getJson(route('workspaces.actionItemComments.index', $params))->assertNotFound();
    $this->actingAs($user)->postJson(route('workspaces.actionItemComments.store', $params), ['content' => 'Still here'])->assertNotFound();
    $this->actingAs($user)->patchJson(route('workspaces.actionItemComments.update', ['workspace' => $team->workspace, 'actionItemComment' => $comment]), ['content' => 'x'])->assertNotFound();
    $this->actingAs($user)->deleteJson(route('workspaces.actionItemComments.destroy', ['workspace' => $team->workspace, 'actionItemComment' => $comment]))->assertNotFound();
    $this->actingAs($user)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), ['team_id' => $team->id, 'content' => 'Nope'])
        ->assertUnprocessable();
})->with(['author', 'assignee']);

it('comments from the workspace as the user and keeps board comments editable there', function () {
    [$retro, $item, $author] = workspaceBoardItem();
    $boardComment = ActionItemComment::factory()->byParticipant($item->createdByParticipant)->create(['action_item_id' => $item->id]);
    $workspace = $retro->team->workspace;

    $this->actingAs($author)
        ->postJson(route('workspaces.actionItemComments.store', ['workspace' => $workspace, 'actionItem' => $item]), ['content' => 'Following up'])
        ->assertCreated()
        ->assertJsonPath('comment.author.name', $author->name)
        ->assertJsonPath('comment.isMine', true);
    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItemComments.update', ['workspace' => $workspace, 'actionItemComment' => $boardComment]), ['content' => 'Edited'])
        ->assertOk()
        ->assertJsonPath('comment.content', 'Edited');
    $this->actingAs($author)
        ->getJson(route('workspaces.actionItemComments.index', ['workspace' => $workspace, 'actionItem' => $item]))
        ->assertOk()
        ->assertJsonCount(2, 'comments');

    expect(ActionItemComment::query()->where('content', 'Following up')->sole()->only(['author_user_id', 'author_participant_id']))
        ->toBe(['author_user_id' => $author->id, 'author_participant_id' => null]);
    Event::assertDispatched(TeamActionItemCommentsChanged::class, fn (TeamActionItemCommentsChanged $event) => $event->commentCount === 2);
});

it('keeps comment rights on the workspace', function () {
    [$retro, $item, $author] = workspaceBoardItem();
    $workspace = $retro->team->workspace;
    $comment = ActionItemComment::factory()->create(['action_item_id' => $item->id, 'author_user_id' => teamMember($retro->team)->id]);
    $other = teamMember($retro->team);
    $params = ['workspace' => $workspace, 'actionItemComment' => $comment];

    $this->actingAs($other)->patchJson(route('workspaces.actionItemComments.update', $params), ['content' => 'Hijacked'])->assertForbidden();
    $this->actingAs($other)->deleteJson(route('workspaces.actionItemComments.destroy', $params))->assertForbidden();
    $this->actingAs($author)->deleteJson(route('workspaces.actionItemComments.destroy', $params))->assertNoContent();
});

it('returns 404 for comments of items the viewer cannot see', function () {
    [$retro, $item] = workspaceBoardItem();
    $comment = ActionItemComment::factory()->create(['action_item_id' => $item->id]);
    $outsider = teamMember(Team::factory()->create(['workspace_id' => $retro->team->workspace_id]));

    $this->actingAs($outsider)
        ->patchJson(route('workspaces.actionItemComments.update', ['workspace' => $retro->team->workspace, 'actionItemComment' => $comment]), ['content' => 'x'])
        ->assertNotFound();
});
