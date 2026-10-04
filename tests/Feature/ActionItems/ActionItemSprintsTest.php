<?php

use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * @return array{sprints: array<int, array<string, mixed>>, withoutSprint: array<int, string>}
 */
function pageSprints(Team $team, User $user): array
{
    $items = test()->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'status' => 'todo,doing,completed']))
        ->assertOk()
        ->viewData('page')['props']['items'];

    return ['sprints' => $items['sprints'], 'withoutSprint' => $items['withoutSprint']];
}

function actionItemCreatedOn(Team $team, User $user, string $day, string $content): ActionItem
{
    test()->travelTo(CarbonImmutable::parse("{$day} 10:00:00"));

    return ActionItem::factory()->withoutRetro($team, $user)->create(['content' => $content]);
}

it('places each row in the sprint of its team that contains its creation day', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $sprint41 = teamSprint($team, 41, '2026-09-07', '2026-09-20');
    $sprint42 = teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $before = actionItemCreatedOn($team, $user, '2026-09-05', 'before the first sprint');
    $last41 = actionItemCreatedOn($team, $user, '2026-09-20', 'last day of 41');
    $first42 = actionItemCreatedOn($team, $user, '2026-09-21', 'first day of 42');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 12:00:00'));

    expect(pageSprints($team, $user))->toBe([
        'sprints' => [
            ['id' => $sprint42->id, 'number' => 42, 'startsOn' => '2026-09-21', 'endsOn' => '2026-10-04', 'teamId' => $team->id, 'state' => 'current', 'itemIds' => [$first42->id]],
            ['id' => $sprint41->id, 'number' => 41, 'startsOn' => '2026-09-07', 'endsOn' => '2026-09-20', 'teamId' => $team->id, 'state' => 'finished', 'itemIds' => [$last41->id]],
        ],
        'withoutSprint' => [$before->id],
    ]);
});

it('lists the current sprint of a team even when no row of the page is in it', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $sprint41 = teamSprint($team, 41, '2026-09-07', '2026-09-20');
    $sprint42 = teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $old = actionItemCreatedOn($team, $user, '2026-09-10', 'in 41');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 12:00:00'));

    expect(collect(pageSprints($team, $user)['sprints'])->map(fn (array $sprint): array => [$sprint['id'], $sprint['state'], $sprint['itemIds']])->all())->toBe([
        [$sprint42->id, 'current', []],
        [$sprint41->id, 'finished', [$old->id]],
    ]);
});

it('lists no sprint between two sprints, nor a planned one', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    teamSprint($team, 41, '2026-09-07', '2026-09-20');
    teamSprint($team, 43, '2026-10-05', '2026-10-18');
    $between = actionItemCreatedOn($team, $user, '2026-09-25', 'between');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 12:00:00'));

    expect(pageSprints($team, $user))->toBe(['sprints' => [], 'withoutSprint' => [$between->id]]);
});

it('keeps the sprints of each team apart and brings none of a team the viewer cannot see', function () {
    $atlas = Team::factory()->create();
    $nova = Team::factory()->create(['workspace_id' => $atlas->workspace_id]);
    $member = teamMember($atlas);
    $manager = workspaceManager($atlas->workspace);
    $atlasSprint = teamSprint($atlas, 42, '2026-09-21', '2026-10-04');
    $novaSprint = teamSprint($nova, 42, '2026-09-21', '2026-10-04');
    $atlasItem = actionItemCreatedOn($atlas, $member, '2026-09-22', 'atlas');
    $novaItem = actionItemCreatedOn($nova, User::factory()->create(), '2026-09-22', 'nova');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 12:00:00'));

    $forManager = collect(pageSprints($atlas, $manager)['sprints'])->mapWithKeys(fn (array $sprint): array => [$sprint['id'] => [$sprint['teamId'], $sprint['itemIds']]])->all();

    expect($forManager)->toEqual([
        $atlasSprint->id => [$atlas->id, [$atlasItem->id]],
        $novaSprint->id => [$nova->id, [$novaItem->id]],
    ])->and(collect(pageSprints($atlas, $member)['sprints'])->pluck('id')->all())->toBe([$atlasSprint->id]);
});

it('sends no sprint for an empty page', function () {
    $team = Team::factory()->create();
    teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 12:00:00'));

    expect(pageSprints($team, teamMember($team)))->toBe(['sprints' => [], 'withoutSprint' => []]);
});
