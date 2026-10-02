<?php

use App\Enums\ActionItemPriority;
use App\Enums\RetroPhase;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * @param  array<string, string>  $query
 */
function actionItemsPage(TestCase $test, User $user, Workspace $workspace, array $query = []): TestResponse
{
    return $test->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $workspace, ...$query]))
        ->assertOk();
}

/**
 * @return array<int, string>
 */
function actionItemsPageIds(TestResponse $response): array
{
    return collect($response->viewData('page')['props']['items']['data'])->pluck('id')->all();
}

it('orders open items overdue first, then by due date, priority and age, then completed ones', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 12:00:00'));
    $team = Team::factory()->create();
    $user = teamMember($team);
    $make = fn (array $attributes) => ActionItem::factory()->withoutRetro($team, $user)->create($attributes);

    $noDateLow = $make(['priority' => ActionItemPriority::Low, 'created_at' => '2026-09-10 10:00:00']);
    $completedEarly = $make(['completed_at' => '2026-10-02 10:00:00']);
    $dueSoonLow = $make(['due_on' => '2026-10-12', 'priority' => ActionItemPriority::Low]);
    $overdueRecent = $make(['due_on' => '2026-10-08']);
    $noDateHighOld = $make(['priority' => ActionItemPriority::High, 'created_at' => '2026-09-01 10:00:00']);
    $completedLate = $make(['completed_at' => '2026-10-09 10:00:00']);
    $dueSoonHigh = $make(['due_on' => '2026-10-12', 'priority' => ActionItemPriority::High]);
    $overdueOld = $make(['due_on' => '2026-10-01']);
    $noDateHighNew = $make(['priority' => ActionItemPriority::High, 'created_at' => '2026-09-05 10:00:00']);

    expect(actionItemsPageIds(actionItemsPage($this, $user, $team->workspace, ['status' => 'all'])))->toBe([
        $overdueOld->id,
        $overdueRecent->id,
        $dueSoonHigh->id,
        $dueSoonLow->id,
        $noDateHighNew->id,
        $noDateHighOld->id,
        $noDateLow->id,
        $completedLate->id,
        $completedEarly->id,
    ]);
});

it('filters by status, assignee and team', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 12:00:00'));
    $team = Team::factory()->create();
    $otherTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $user = teamMember($team);
    $otherTeam->members()->attach($user);
    $colleague = teamMember($team);
    $mine = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create();
    $theirs = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($colleague)->create(['due_on' => '2026-10-01']);
    $nobodys = ActionItem::factory()->withoutRetro($otherTeam, $user)->create();
    $done = ActionItem::factory()->withoutRetro($team, $user)->completed()->create();
    $workspace = $team->workspace;
    $ids = fn (array $query) => collect(actionItemsPageIds(actionItemsPage($this, $user, $workspace, $query)))->sort()->values()->all();
    $expected = fn (ActionItem ...$items) => collect($items)->pluck('id')->sort()->values()->all();

    expect($ids([]))->toBe($expected($mine, $theirs, $nobodys))
        ->and($ids(['status' => 'overdue']))->toBe($expected($theirs))
        ->and($ids(['status' => 'completed']))->toBe($expected($done))
        ->and($ids(['status' => 'all']))->toBe($expected($mine, $theirs, $nobodys, $done))
        ->and($ids(['assignee' => 'me']))->toBe($expected($mine))
        ->and($ids(['assignee' => 'unassigned']))->toBe($expected($nobodys))
        ->and($ids(['assignee' => $colleague->id]))->toBe($expected($theirs))
        ->and($ids(['team' => $otherTeam->id]))->toBe($expected($nobodys));
});

it('ignores unknown filter values', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $invisibleTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create();

    actionItemsPage($this, $user, $team->workspace, ['status' => 'bogus', 'assignee' => 'somebody', 'team' => $invisibleTeam->id, 'item' => 'nope'])
        ->assertInertia(fn (Assert $page) => $page
            ->component('action-items/index', false)
            ->where('filters', ['status' => 'open', 'assignee' => null, 'team' => null, 'item' => null])
            ->where('items.data.0.id', $item->id)
            ->where('focusedItem', null));
});

it('shows members only their teams and admins every team of the workspace', function () {
    $team = Team::factory()->create();
    $hiddenTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $member = teamMember($team);
    $admin = workspaceManager($team->workspace);
    $boardItem = ActionItem::factory()->create(['retro_id' => Retro::factory()->create(['team_id' => $team->id])->id]);
    $teamItem = ActionItem::factory()->withoutRetro($team, $member)->create();
    $hiddenItem = ActionItem::factory()->withoutRetro($hiddenTeam, teamMember($hiddenTeam))->create();
    ActionItem::factory()->create();

    $sorted = fn (array $ids) => collect($ids)->sort()->values()->all();

    expect($sorted(actionItemsPageIds(actionItemsPage($this, $member, $team->workspace))))
        ->toBe($sorted([$boardItem->id, $teamItem->id]))
        ->and($sorted(actionItemsPageIds(actionItemsPage($this, $admin, $team->workspace))))
        ->toBe($sorted([$boardItem->id, $teamItem->id, $hiddenItem->id]));
});

it('deep links to a visible item and ignores the others', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->completed()->create();
    $hidden = ActionItem::factory()->withoutRetro(Team::factory()->create(['workspace_id' => $team->workspace_id]), $user)->create();

    actionItemsPage($this, $user, $team->workspace, ['item' => $item->id])
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.item', $item->id)
            ->where('focusedItem.id', $item->id)
            ->where('focusedItem.status', 'completed'));

    actionItemsPage($this, $user, $team->workspace, ['item' => $hidden->id])
        ->assertInertia(fn (Assert $page) => $page->where('focusedItem', null));
});

it('paginates fifty items per page', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->count(51)->withoutRetro($team, $user)->create();

    actionItemsPage($this, $user, $team->workspace)
        ->assertInertia(fn (Assert $page) => $page
            ->has('items.data', 50)
            ->where('items.total', 51)
            ->where('items.lastPage', 2));

    actionItemsPage($this, $user, $team->workspace, ['page' => '2'])
        ->assertInertia(fn (Assert $page) => $page->has('items.data', 1)->where('items.currentPage', 2));
});

it('offers creatable teams, assignees, channels and the viewer context', function () {
    $team = Team::factory()->create(['name' => 'Alpha']);
    $adminOnlyTeam = Team::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Beta']);
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin);
    $colleague = teamMember($team);
    $running = Retro::factory()->create(['team_id' => $team->id]);
    $finished = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $adminOnlyTeam->id]);
    $running->forceFill(['facilitator_participant_id' => Participant::factory()->create(['retro_id' => $running->id, 'user_id' => $admin->id])->id])->save();
    $finished->forceFill(['facilitator_participant_id' => Participant::factory()->create(['retro_id' => $finished->id, 'user_id' => $admin->id])->id])->save();

    actionItemsPage($this, $admin, $team->workspace)
        ->assertInertia(fn (Assert $page) => $page
            ->where('filterTeams.0.name', 'Alpha')
            ->where('filterTeams.1.name', 'Beta')
            ->where('teams', [
                ['id' => $team->id, 'name' => 'Alpha'],
                ['id' => $adminOnlyTeam->id, 'name' => 'Beta'],
            ])
            ->has('creatableTeams', 1)
            ->where('creatableTeams.0.id', $team->id)
            ->where('realtimeTeamIds', [$team->id, $adminOnlyTeam->id])
            ->where('viewer.userId', $admin->id)
            ->where('viewer.isWorkspaceManager', true)
            ->where('viewer.reviewTeamIds', [$team->id])
            ->where('viewer.facilitatedRetroIds', fn ($ids) => collect($ids)->sort()->values()->all() === collect([$running->id, $finished->id])->sort()->values()->all())
            ->where('assignees', fn ($assignees) => collect($assignees)->pluck('id')->contains($colleague->id)));

    actionItemsPage($this, $admin, $team->workspace, ['team' => $adminOnlyTeam->id])
        ->assertInertia(fn (Assert $page) => $page->where('realtimeTeamIds', [$adminOnlyTeam->id]));
});

it('loads the page with a constant number of queries', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $seed = function (int $count) use ($team, $user): void {
        $retro = Retro::factory()->create(['team_id' => $team->id]);
        ActionItem::factory()->count($count)->assignedTo($user)->create(['retro_id' => $retro->id])
            ->each(fn (ActionItem $item) => ActionItemComment::factory()->create(['action_item_id' => $item->id]));
        ActionItem::factory()->count($count)->withoutRetro($team, $user)->create();

        $otherTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
        $otherTeam->members()->attach($user);
        $otherRetro = Retro::factory()->create(['team_id' => $otherTeam->id]);
        $otherRetro->forceFill(['facilitator_participant_id' => Participant::factory()->create(['retro_id' => $otherRetro->id, 'user_id' => $user->id])->id])->save();
        ActionItem::factory()->count($count)->create(['retro_id' => $otherRetro->id]);
    };
    $countQueries = function () use ($team, $user): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        actionItemsPage($this, $user, $team->workspace);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(2);
    $countQueries();
    $small = $countQueries();

    $seed(6);

    expect($countQueries())->toBe($small);
});

it('counts open action items on the team page', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->count(2)->withoutRetro($team, $user)->create();
    ActionItem::factory()->withoutRetro($team, $user)->completed()->create();

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('openActionItemCount', 2));
});

it('counts open, overdue, completed, own and ritual items ignoring the status filter', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 12:00:00'));
    $team = Team::factory()->create();
    $user = teamMember($team);
    $colleague = teamMember($team);
    $firstRetro = Retro::factory()->create(['team_id' => $team->id]);
    $secondRetro = Retro::factory()->create(['team_id' => $team->id]);
    ActionItem::factory()->create(['team_id' => $team->id, 'retro_id' => $firstRetro->id, 'assignee_user_id' => $user->id]);
    ActionItem::factory()->create(['team_id' => $team->id, 'retro_id' => $firstRetro->id, 'due_on' => '2026-10-01', 'assignee_user_id' => $colleague->id]);
    ActionItem::factory()->create(['team_id' => $team->id, 'retro_id' => $secondRetro->id, 'completed_at' => '2026-10-02 10:00:00', 'assignee_user_id' => $user->id]);
    ActionItem::factory()->withoutRetro($team, $user)->create(['due_on' => '2026-10-20']);

    foreach (['open', 'overdue', 'completed', 'all'] as $status) {
        actionItemsPage($this, $user, $team->workspace, ['status' => $status])
            ->assertInertia(fn (Assert $page) => $page->where('counts', [
                'open' => 3,
                'overdue' => 1,
                'completed' => 1,
                'mine' => 1,
                'rituals' => 2,
            ]));
    }
});

it('narrows the counts by team and assignee', function () {
    $team = Team::factory()->create();
    $otherTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $user = teamMember($team);
    $otherTeam->members()->attach($user);
    $colleague = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create();
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($colleague)->create();
    ActionItem::factory()->withoutRetro($team, $user)->completed()->create();
    ActionItem::factory()->withoutRetro($otherTeam, $user)->create();

    actionItemsPage($this, $user, $team->workspace, ['team' => $otherTeam->id])
        ->assertInertia(fn (Assert $page) => $page->where('counts', [
            'open' => 1, 'overdue' => 0, 'completed' => 0, 'mine' => 0, 'rituals' => 0,
        ]));

    actionItemsPage($this, $user, $team->workspace, ['assignee' => $colleague->id])
        ->assertInertia(fn (Assert $page) => $page->where('counts', [
            'open' => 1, 'overdue' => 0, 'completed' => 0, 'mine' => 0, 'rituals' => 0,
        ]));

    actionItemsPage($this, $user, $team->workspace, ['team' => $team->id, 'assignee' => 'me'])
        ->assertInertia(fn (Assert $page) => $page->where('counts', [
            'open' => 1, 'overdue' => 0, 'completed' => 0, 'mine' => 1, 'rituals' => 0,
        ]));
});

it('counts nothing from a team the user cannot see', function () {
    $team = Team::factory()->create();
    $hiddenTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $member = teamMember($team);
    $hiddenRetro = Retro::factory()->create(['team_id' => $hiddenTeam->id]);
    ActionItem::factory()->withoutRetro($team, $member)->create();
    ActionItem::factory()->create(['team_id' => $hiddenTeam->id, 'retro_id' => $hiddenRetro->id, 'due_on' => '2020-01-01']);
    ActionItem::factory()->create(['team_id' => $hiddenTeam->id, 'retro_id' => $hiddenRetro->id, 'completed_at' => '2026-10-02 10:00:00']);

    actionItemsPage($this, $member, $team->workspace)
        ->assertInertia(fn (Assert $page) => $page->where('counts', [
            'open' => 1, 'overdue' => 0, 'completed' => 0, 'mine' => 0, 'rituals' => 0,
        ]));
});

it('loads the counts lazily with the items', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $user)->create();
    $url = route('workspaces.actionItems.index', $team->workspace);
    $partial = fn (string $only) => $this->actingAs($user)->get($url, [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => app(HandleInertiaRequests::class)->version(request()),
        'X-Inertia-Partial-Component' => 'action-items/index',
        'X-Inertia-Partial-Data' => $only,
    ])->assertOk()->json('props');

    expect($partial('items'))->toHaveKey('items')->not->toHaveKey('counts')
        ->and($partial('items,counts'))->toHaveKey('counts');
});
