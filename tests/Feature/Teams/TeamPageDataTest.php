<?php

use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamActivity;
use App\Models\Whiteboard;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

it('sends the first five open action items, overdue first, with the overdue count', function () {
    $team = Team::factory()->create();
    $this->travelTo(CarbonImmutable::parse('2026-10-01 09:00', 'UTC'));
    $make = fn (string $content, ?string $dueOn, bool $done = false) => ActionItem::factory()->for($team)->create([
        'retro_id' => null,
        'content' => $content,
        'due_on' => $dueOn,
        'completed_at' => $done ? now() : null,
    ]);
    $make('Later', '2026-10-20');
    $make('Late two', '2026-09-26');
    $make('No date', null);
    $make('Late one', '2026-09-20');
    $make('Soon', '2026-10-03');
    $make('Next week', '2026-10-08');
    $make('Done and late', '2026-09-01', true);

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('overdueActionItemCount', 2)
            ->where('openActionItemCount', 6)
            ->has('openActionItems', 5)
            ->where('openActionItems.0.content', 'Late one')
            ->where('openActionItems.1.content', 'Late two')
            ->where('openActionItems.2.content', 'Soon')
            ->where('openActionItems.4.content', 'Later'));
});

it('counts the participants, cards and action items of a finished retro on its recent row', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create();
    [$author, $other] = Participant::factory()->count(2)->create(['retro_id' => $retro->id]);
    $parent = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $author->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $other->id, 'column_id' => $parent->column_id, 'parent_card_id' => $parent->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $author->id, 'column_id' => $parent->column_id]);
    ActionItem::factory()->for($team)->create(['retro_id' => $retro->id, 'created_by_participant_id' => $author->id]);

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('recentSessions.0.participants', 2)
            ->where('recentSessions.0.meta.cards', 3)
            ->where('recentSessions.0.outcome', ['kind' => 'actions', 'count' => 1]));
});

it('sends Home the live sessions apart from the five latest others, and says when a team has none', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs($member)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('hasSessions', false)
            ->where('liveSessions', ['count' => 0])
            ->where('liveNow', [])
            ->where('recentSessions', []));

    Retro::factory()->for($team)->started()->create(['title' => 'Live retro']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->count(6)->create();

    $this->actingAs($member)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('hasSessions', true)
            ->has('liveNow', 1)
            ->where('liveNow.0.title', 'Live retro')
            ->has('recentSessions', 5)
            ->where('recentSessions.0.state', 'finished'));
});

it('sends Home the five newest lines', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    foreach (range(1, 7) as $minute) {
        $this->travelTo(now()->addMinute());
        TeamActivity::factory()->for($team)->create(['actor_user_id' => $member->id, 'subject_title' => "Line {$minute}"]);
    }

    $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('activity', 5)
            ->where('activity.0.subject.title', 'Line 7')
            ->where('activity.4.subject.title', 'Line 3'));
});

it('no longer sends Home the lists that moved to other pages', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->missing('retros')
            ->missing('pokerGames')
            ->missing('whiteboards')
            ->missing('healthStatements')
            ->missing('pendingInvitations')
            ->missing('members.0.email'));
});

it('defers the latest health check with the trend: its score, and its change once there is one before it', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->missing('latestHealth')
            ->loadDeferredProps('trend', fn (Assert $reload) => $reload->where('latestHealth', null)));

    $first = Retro::factory()->for($team)->withHealthCheck()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()->subWeek()]);
    answerHealthCheck($first, Participant::factory()->create(['retro_id' => $first->id]), ['vision' => 3, 'motivation' => 4]);
    answerHealthCheck($first, Participant::factory()->create(['retro_id' => $first->id]), ['vision' => 4, 'motivation' => 4]);
    closeHealthCheck($first);

    $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('trend', fn (Assert $reload) => $reload
                ->where('latestHealth.score', 3.8)
                ->where('latestHealth.change', null)
                ->missing('latestHealthScore')));

    $second = Retro::factory()->for($team)->withHealthCheck()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    answerHealthCheck($second, Participant::factory()->create(['retro_id' => $second->id]), ['vision' => 2, 'motivation' => 3]);
    closeHealthCheck($second);

    $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('trend', fn (Assert $reload) => $reload
                ->where('latestHealth.score', 2.5)
                ->where('latestHealth.change', -1.3)));
});

it('sends Home the latest team eNPS with the trend', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->missing('latestEnps')
            ->loadDeferredProps('trend', fn (Assert $reload) => $reload->where('latestEnps', null)));

    closedEnps($team, [10, 10, 8, 8, 0], now()->subMonth());
    closedEnps($team, [10, 10, 9, 9, 9, 8, 7, 3, 0]);

    $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('trend', fn (Assert $reload) => $reload->where('latestEnps', ['score' => 33, 'change' => 13])));
});

it('tells Home whether its viewer may set the rituals of the team', function () {
    $team = Team::factory()->create();
    $canManageRituals = fn (TeamRole $role): bool => $this->actingAs(teamMember($team, $role))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->inertiaProps('canManageRituals');

    expect($canManageRituals(TeamRole::Facilitator))->toBeTrue()
        ->and($canManageRituals(TeamRole::Member))->toBeFalse();
});

it('counts the whiteboards edited today on the workspace tile', function () {
    $team = Team::factory()->create();
    $this->travelTo(CarbonImmutable::parse('2026-10-01 15:00', 'UTC'));
    Whiteboard::factory()->for($team)->create(['updated_at' => now()->subHours(2)]);
    Whiteboard::factory()->for($team)->create(['updated_at' => now()->subDay()]);

    $this->actingAs(teamMember($team))->get(route('workspaces.show', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page->where('teams.0.activity.whiteboardsEditedToday', 1));
});
