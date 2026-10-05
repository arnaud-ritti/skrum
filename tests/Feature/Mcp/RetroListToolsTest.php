<?php

use App\Enums\ActionItemPriority;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Mcp\Tools\Retro\ListActionItems;
use App\Mcp\Tools\Retro\ListBoardActionItems;
use App\Mcp\Tools\Retro\ListBoards;
use App\Mcp\Tools\Retro\ListTeamMembers;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

it('lists the team roster with workspace permissions and no emails', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin);

    $response = actingAsMcp($member)->tool(ListTeamMembers::class, ['team_id' => $team->id])->assertOk();
    $members = collect(mcpStructured($response)['members']);

    expect($members->pluck('permission', 'userId')->all())->toEqual([
        $member->id => 'member',
        $admin->id => 'admin',
    ])
        ->and(json_encode($members))->not->toContain('@')
        ->and($members->first())->toHaveKeys(['userId', 'name', 'avatarUrl', 'permission', 'role']);
});

it('lists each member with their team role', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $facilitator = teamMember($team, TeamRole::Facilitator);

    $response = actingAsMcp($member)->tool(ListTeamMembers::class, ['team_id' => $team->id])->assertOk();

    expect(collect(mcpStructured($response)['members'])->pluck('role', 'userId')->all())->toEqual([
        $member->id => 'member',
        $facilitator->id => 'facilitator',
    ]);
});

it('hides the roster of teams the user cannot see', function () {
    $user = teamMember(Team::factory()->create());
    $other = Team::factory()->create();

    actingAsMcp($user)->tool(ListTeamMembers::class, ['team_id' => $other->id])->assertHasErrors(['Not found.']);
});

it('refuses malformed ids', function () {
    $user = teamMember(Team::factory()->create());

    actingAsMcp($user)->tool(ListTeamMembers::class, ['team_id' => 'not-a-uuid'])->assertHasErrors(['The team id field must be a valid UUID.']);
});

it('lists boards newest first with date and finished filters', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $old = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['created_at' => '2026-09-01 10:00:00']);
    $recent = Retro::factory()->for($team)->create(['created_at' => '2026-09-20 10:00:00']);

    $all = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id])->assertOk());

    expect(collect($all['items'])->pluck('id')->all())->toBe([$recent->id, $old->id])
        ->and($all['items'][0])->toHaveKeys(['id', 'title', 'teamId', 'teamName', 'phase', 'isFinished', 'url'])
        ->and($all['hasMore'])->toBeFalse();

    $finished = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'finished_only' => true]));
    $since = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'since' => '2026-09-10']));
    $until = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'until' => '2026-09-10']));

    expect(collect($finished['items'])->pluck('id')->all())->toBe([$old->id])
        ->and(collect($since['items'])->pluck('id')->all())->toBe([$recent->id])
        ->and(collect($until['items'])->pluck('id')->all())->toBe([$old->id]);
});

it('paginates boards', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    Retro::factory()->for($team)->count(3)->create();

    $first = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'limit' => 2]));
    $second = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'limit' => 2, 'page' => 2]));

    expect($first['items'])->toHaveCount(2)
        ->and($first['hasMore'])->toBeTrue()
        ->and($second['items'])->toHaveCount(1)
        ->and($second['page'])->toBe(2)
        ->and($second['hasMore'])->toBeFalse();

    actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'limit' => 51])->assertHasErrors();
});

it('lists open action items across the visible teams by default', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $open = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Open one']);
    ActionItem::factory()->withoutRetro($team, $user)->completed()->create(['content' => 'Done one']);
    ActionItem::factory()->withoutRetro(Team::factory()->create(), User::factory()->create())->create(['content' => 'Foreign']);

    $result = mcpStructured(actingAsMcp($user)->tool(ListActionItems::class)->assertOk());

    expect(collect($result['items'])->pluck('id')->all())->toBe([$open->id])
        ->and($result['items'][0])->toHaveKeys(['boardId', 'teamId', 'content', 'status', 'assignee', 'createdBy', 'subtasks', 'url'])
        ->and($result['items'][0]['boardId'])->toBeNull()
        ->and($result['items'][0]['url'])->toContain('/action-items?item='.$open->id);
});

it('filters action items by status, assignee and team', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $mate = teamMember($team);
    $mine = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create();
    $theirs = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($mate)->create();
    $unassigned = ActionItem::factory()->withoutRetro($team, $user)->create();
    $overdue = ActionItem::factory()->withoutRetro($team, $user)->overdue()->create();
    $done = ActionItem::factory()->withoutRetro($team, $user)->completed()->create();

    $ids = fn (array $arguments) => collect(mcpStructured(actingAsMcp($user)->tool(ListActionItems::class, $arguments))['items'])->pluck('id')->sort()->values()->all();

    expect($ids(['assignee' => 'me']))->toBe([$mine->id])
        ->and($ids(['assignee' => $mate->id]))->toBe([$theirs->id])
        ->and($ids(['assignee' => 'unassigned']))->toBe(collect([$unassigned->id, $overdue->id])->sort()->values()->all())
        ->and($ids(['status' => 'overdue']))->toBe([$overdue->id])
        ->and($ids(['status' => 'completed']))->toBe([$done->id])
        ->and($ids(['status' => 'all']))->toHaveCount(5)
        ->and($ids(['team_id' => $team->id]))->toHaveCount(4);

    actingAsMcp($user)->tool(ListActionItems::class, ['status' => 'someday'])->assertHasErrors();
    actingAsMcp($user)->tool(ListActionItems::class, ['team_id' => Team::factory()->create()->id])->assertHasErrors(['Not found.']);
});

it('merges action items across workspaces', function () {
    $user = User::factory()->create();
    $first = Team::factory()->create(['name' => 'Core']);
    $second = Team::factory()->create(['name' => 'Core']);

    foreach ([$first, $second] as $team) {
        $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($user);
    }

    $high = ActionItem::factory()->withoutRetro($second, $user)->priority(ActionItemPriority::High)->create();
    $overdue = ActionItem::factory()->withoutRetro($first, $user)->overdue()->create();
    $low = ActionItem::factory()->withoutRetro($first, $user)->priority(ActionItemPriority::Low)->create();

    $items = mcpStructured(actingAsMcp($user)->tool(ListActionItems::class))['items'];

    expect(collect($items)->pluck('id')->all())->toBe([$overdue->id, $high->id, $low->id]);

    $onlySecond = mcpStructured(actingAsMcp($user)->tool(ListActionItems::class, ['workspace_id' => $second->workspace_id]))['items'];

    expect(collect($onlySecond)->pluck('id')->all())->toBe([$high->id]);

    actingAsMcp($user)->tool(ListActionItems::class, ['workspace_id' => Workspace::factory()->create()->id])->assertHasErrors(['Not found.']);
});

it('lets workspace managers list every team of their workspace', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();

    expect(collect(mcpStructured(actingAsMcp($admin)->tool(ListActionItems::class))['items'])->pluck('id')->all())->toBe([$item->id]);
});

it('keeps a bound token inside its team', function () {
    $user = User::factory()->create();
    $bound = Team::factory()->create();
    $sibling = Team::factory()->create(['workspace_id' => $bound->workspace_id]);
    $bound->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $bound->members()->attach($user);
    $sibling->members()->attach($user);
    $inBound = ActionItem::factory()->withoutRetro($bound, $user)->create();
    ActionItem::factory()->withoutRetro($sibling, $user)->create();

    $items = mcpStructured(actingAsMcp($user, [McpScope::Read], $bound)->tool(ListActionItems::class))['items'];

    expect(collect($items)->pluck('id')->all())->toBe([$inBound->id]);

    actingAsMcp($user, [McpScope::Read], $bound)->tool(ListBoards::class, ['team_id' => $sibling->id])->assertHasErrors(['Not found.']);
});

it('lists a board action items in creation order and names creators on anonymous boards', function () {
    $retro = Retro::factory()->anonymous()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroMember($retro);
    $first = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id, 'created_by_user_id' => $user->id, 'created_at' => now()->subMinute()]);
    $second = ActionItem::factory()->create(['retro_id' => $retro->id]);

    $items = mcpStructured(actingAsMcp($user)->tool(ListBoardActionItems::class, ['board_id' => $retro->id])->assertOk())['items'];

    expect(collect($items)->pluck('id')->all())->toBe([$first->id, $second->id])
        ->and($items[0]['boardId'])->toBe($retro->id)
        ->and($items[0]['createdBy']['name'])->toBe($user->name);

    actingAsMcp(teamMember(Team::factory()->create()))->tool(ListBoardActionItems::class, ['board_id' => $retro->id])->assertHasErrors(['Not found.']);
});

it('intersects the team and workspace filters of action items', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create();
    $otherWorkspace = Workspace::factory()->create();

    $matching = mcpStructured(actingAsMcp($user)->tool(ListActionItems::class, [
        'team_id' => $team->id,
        'workspace_id' => $team->workspace_id,
    ])->assertOk());

    expect(collect($matching['items'])->pluck('id')->all())->toBe([$item->id]);

    actingAsMcp($user)->tool(ListActionItems::class, [
        'team_id' => $team->id,
        'workspace_id' => $otherWorkspace->id,
    ])->assertHasErrors(['Not found.']);
});

it('returns absolute avatar urls in action items', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create();

    $item = mcpStructured(actingAsMcp($user)->tool(ListActionItems::class)->assertOk())['items'][0];

    expect($item['assignee']['avatarUrl'])->toStartWith(config('app.url'))
        ->and($item['createdBy']['avatarUrl'])->toStartWith(config('app.url'));
});

it('reports the owner permission of a workspace owner in the roster', function () {
    $team = Team::factory()->create();
    $owner = workspaceManager($team->workspace, WorkspaceRole::Owner);
    $team->members()->attach($owner);

    $members = collect(mcpStructured(actingAsMcp($owner)->tool(ListTeamMembers::class, ['team_id' => $team->id])->assertOk())['members']);

    expect($members->pluck('permission', 'userId')->all())->toEqual([$owner->id => 'owner']);
});

it('includes boards created late on the until date and excludes the next midnight', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $lastMinute = Retro::factory()->for($team)->create(['created_at' => '2026-09-10 23:59:00']);
    Retro::factory()->for($team)->create(['created_at' => '2026-09-11 00:00:00']);
    $firstMinute = Retro::factory()->for($team)->create(['created_at' => '2026-09-10 00:00:00']);
    Retro::factory()->for($team)->create(['created_at' => '2026-09-09 23:59:00']);

    $between = mcpStructured(actingAsMcp($user)->tool(ListBoards::class, ['team_id' => $team->id, 'since' => '2026-09-10', 'until' => '2026-09-10'])->assertOk());

    expect(collect($between['items'])->pluck('id')->all())->toBe([$lastMinute->id, $firstMinute->id]);
});

it('combines the overdue status with the assignee filter', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $mate = teamMember($team);
    $myOverdue = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->overdue()->create();
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($mate)->overdue()->create();
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create();
    $myDone = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->completed()->create();

    $ids = fn (array $arguments) => collect(mcpStructured(actingAsMcp($user)->tool(ListActionItems::class, $arguments)->assertOk())['items'])->pluck('id')->sort()->values()->all();

    expect($ids(['status' => 'overdue', 'assignee' => 'me']))->toBe([$myOverdue->id])
        ->and($ids(['status' => 'all', 'assignee' => 'me']))->toContain($myDone->id)->toHaveCount(3);
});

it('lists started action items and keeps the single statuses of before', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $started = ActionItem::factory()->withoutRetro($team, $user)->started()->create();
    $todo = ActionItem::factory()->withoutRetro($team, $user)->create();
    $ids = fn (array $arguments) => collect(mcpStructured(actingAsMcp($user)->tool(ListActionItems::class, $arguments))['items'])->pluck('id')->sort()->values()->all();

    expect($ids(['status' => 'doing']))->toBe([$started->id])
        ->and($ids(['status' => 'open']))->toBe(collect([$started->id, $todo->id])->sort()->values()->all())
        ->and(collect(mcpStructured(actingAsMcp($user)->tool(ListActionItems::class, ['status' => 'doing']))['items'])->first()['status'])->toBe('doing');
});
