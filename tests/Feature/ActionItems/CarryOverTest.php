<?php

use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Actions\ActionItems\CarriedActionItems;
use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * @return array<int, string>
 */
function carriedIds(Retro $retro): array
{
    return app(CarriedActionItems::class)->handle($retro->fresh())['items']->pluck('id')->sort()->values()->all();
}

it('carries only earlier open or recently completed items', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:00'));
    $team = Team::factory()->create();
    $earlier = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => '2026-09-01 10:00:00']);
    $current = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-10-01 10:00:00']);
    $later = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-10-03 10:00:00']);
    $otherTeam = Retro::factory()->inPhase(RetroPhase::Completed)->create(['created_at' => '2026-09-01 10:00:00']);
    $open = ActionItem::factory()->create(['retro_id' => $earlier->id]);
    $completedDuringReview = ActionItem::factory()->create(['retro_id' => $earlier->id, 'completed_at' => '2026-10-01 11:00:00']);
    ActionItem::factory()->create(['retro_id' => $earlier->id, 'completed_at' => '2026-09-20 10:00:00']);
    ActionItem::factory()->create(['retro_id' => $current->id]);
    ActionItem::factory()->create(['retro_id' => $later->id]);
    ActionItem::factory()->create(['retro_id' => $otherTeam->id]);

    expect(carriedIds($current))->toBe(collect([$open->id, $completedDuringReview->id])->sort()->values()->all())
        ->and(app(CarriedActionItems::class)->handle($current->fresh())['hasMore'])->toBeFalse();
});

it('carries items added outside a retro only into later retros', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:00'));
    $team = Team::factory()->create();
    $running = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-10-01 10:00:00']);
    $next = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-10-04 10:00:00']);
    $teamItem = ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['created_at' => '2026-10-02 10:00:00']);

    expect(carriedIds($running))->toBe([])
        ->and(carriedIds($next))->toBe([$teamItem->id]);
});

it('caps the carried items at two hundred', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->create(['team_id' => $team->id]);
    ActionItem::factory()->count(201)->withoutRetro($team, teamMember($team))->create(['created_at' => now()->subDay()]);

    $carried = app(CarriedActionItems::class)->handle($retro->fresh());

    expect($carried['items'])->toHaveCount(200)
        ->and($carried['hasMore'])->toBeTrue();
});

it('adds carried items and the team context to member snapshots', function () {
    $team = Team::factory()->create();
    $earlier = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => now()->subWeek()]);
    $item = ActionItem::factory()->create(['retro_id' => $earlier->id]);
    $current = Retro::factory()->anonymous()->create(['team_id' => $team->id]);
    [$user, $viewer] = retroMember($current);

    $snapshot = app(BuildBoardSnapshot::class)->handle($current->fresh(), $viewer);

    expect($snapshot['carriedActionItems'])->toHaveCount(1)
        ->and($snapshot['carriedActionItems'][0]['id'])->toBe($item->id)
        ->and($snapshot['carriedActionItems'][0]['createdBy'])->not->toBeNull()
        ->and($snapshot['carriedActionItemsHasMore'])->toBeFalse()
        ->and($snapshot['retro']['teamId'])->toBe($team->id)
        ->and($snapshot['viewer'])->toMatchArray([
            'userId' => $user->id,
            'canManageActionItems' => false,
            'isWorkspaceManager' => false,
            'isReviewFacilitator' => false,
            'facilitatedRetroIds' => [],
        ])
        ->and($snapshot['teamMembers'])->toContain([
            'id' => $user->id,
            'name' => $user->name,
            'avatarUrl' => $user->avatarUrl(),
            'participantId' => $viewer->id,
        ])
        ->and($snapshot['links']['actionItems'])->toBe(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'team' => $team->id]))
        ->and($snapshot['links']['workspace'])->toBe($team->workspace->slug);
});

it('marks the facilitator and workspace admins as managers', function () {
    $retro = Retro::factory()->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $admin] = workspaceAdminParticipant($retro);

    $facilitatorView = app(BuildBoardSnapshot::class)->handle($retro->fresh(), $facilitator)['viewer'];
    $adminView = app(BuildBoardSnapshot::class)->handle($retro->fresh(), $admin)['viewer'];

    expect($facilitatorView)->toMatchArray([
        'canManageActionItems' => true,
        'isWorkspaceManager' => false,
        'isReviewFacilitator' => true,
        'facilitatedRetroIds' => [$retro->id],
    ])
        ->and($adminView)->toMatchArray([
            'canManageActionItems' => true,
            'isWorkspaceManager' => true,
            'isReviewFacilitator' => false,
        ]);
});

it('never gives carried items to guests', function () {
    $team = Team::factory()->create();
    $earlier = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => now()->subWeek()]);
    ActionItem::factory()->create(['retro_id' => $earlier->id, 'content' => 'Secret follow-up']);
    $current = Retro::factory()->withGuestAccess()->create(['team_id' => $team->id]);
    $member = teamMember($team);
    $guest = Participant::factory()->guest()->create(['retro_id' => $current->id]);

    $snapshot = app(BuildBoardSnapshot::class)->handle($current->fresh(), $guest);

    expect($snapshot['carriedActionItems'])->toBe([])
        ->and($snapshot['carriedActionItemsHasMore'])->toBeFalse()
        ->and($snapshot['links']['actionItems'])->toBeNull()
        ->and($snapshot['links']['workspace'])->toBeNull()
        ->and($snapshot['viewer']['userId'])->toBeNull()
        ->and(json_encode($snapshot))->not->toContain('Secret follow-up')
        ->and(json_encode($snapshot))->not->toContain($member->email)
        ->and(collect($snapshot['teamMembers'])->pluck('id')->all())->toContain($member->id);
});

it('builds the action item parts of the snapshot with a constant number of queries', function () {
    $team = Team::factory()->create();
    $current = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $team->id]);
    [, $viewer] = retroMember($current);
    $seed = function (int $count) use ($team, $current): void {
        $earlier = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => now()->subWeek()]);
        ActionItem::factory()->count($count)->create(['retro_id' => $earlier->id])
            ->each(fn (ActionItem $item) => ActionItemComment::factory()->create(['action_item_id' => $item->id]));
        ActionItem::factory()->count($count)->withoutRetro($team, teamMember($team))->create(['created_at' => now()->subDay()]);
        ActionItem::factory()->count($count)->create(['retro_id' => $current->id]);
    };
    $countQueries = function () use ($current, $viewer): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        app(BuildBoardSnapshot::class)->handle($current->fresh(), $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(2);
    $small = $countQueries();

    $seed(6);

    expect($countQueries())->toBe($small);
});

it('agrees with the broadcast fan-out on which retros carry an item', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-20 10:00:00'));
    $team = Team::factory()->create();
    $r1 = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => '2026-09-01 10:00:00']);
    $r2 = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-09-10 10:00:00']);
    $r3 = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-09-20 10:00:00']);
    $r4 = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-10-01 10:00:00']);
    $other = Retro::factory()->create(['created_at' => '2026-10-02 10:00:00']);
    $retros = collect([$r2, $r3, $r4, $other]);
    $items = collect([
        ActionItem::factory()->create(['retro_id' => $r1->id]),
        ActionItem::factory()->create(['retro_id' => $r1->id, 'completed_at' => '2026-09-05 10:00:00']),
        ActionItem::factory()->create(['retro_id' => $r1->id, 'completed_at' => '2026-09-15 10:00:00']),
        ActionItem::factory()->create(['retro_id' => $r2->id, 'completed_at' => '2026-09-25 10:00:00']),
        ActionItem::factory()->create(['retro_id' => $r3->id]),
        ActionItem::factory()->create(['retro_id' => $r4->id]),
        ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['created_at' => '2026-09-12 10:00:00']),
        ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['created_at' => '2026-09-12 10:00:00', 'completed_at' => '2026-09-30 10:00:00']),
        ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['created_at' => '2026-10-10 10:00:00']),
        ActionItem::factory()->create(['retro_id' => $other->id]),
        ActionItem::factory()->create(['retro_id' => $r1->id, 'completed_at' => $r2->created_at]),
        ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['created_at' => $r3->created_at]),
    ]);

    $viaBroadcast = fn () => $items->mapWithKeys(fn (ActionItem $item) => [
        $item->id => collect(app(BroadcastActionItemChange::class)->carryingRetroIds($item->fresh()))->sort()->values()->all(),
    ]);
    $viaQuery = fn () => $items->mapWithKeys(fn (ActionItem $item) => [
        $item->id => $retros
            ->filter(fn (Retro $retro) => in_array($item->id, carriedIds($retro), true))
            ->pluck('id')
            ->sort()
            ->values()
            ->all(),
    ]);

    expect($viaQuery()->all())->toBe($viaBroadcast()->all());
});
