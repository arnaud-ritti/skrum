<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\Teams\AnswerTeamAccessRequest;
use App\Actions\Teams\JoinTeamByLink;
use App\Actions\Teams\ListTeamActivity;
use App\Actions\Teams\RecordTeamActivity;
use App\Enums\ActionItemStatus;
use App\Enums\RetroPhase;
use App\Enums\TeamActivityKind;
use App\Enums\TeamSurveyQuestionKind;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\TeamActivity;
use App\Models\TeamInviteLink;
use App\Models\TeamSurvey;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

function lastActivity(Team $team): TeamActivity
{
    return TeamActivity::query()->where('team_id', $team->id)->latest()->orderByDesc('id')->firstOrFail();
}

/**
 * @param  array<string, string|null>  $query
 * @return array<string, mixed>
 */
function activityPage(Team $team, User $viewer, array $query = []): array
{
    return test()->actingAs($viewer)
        ->get(route('teams.activity.index', [$team->workspace, $team, ...$query]))
        ->assertOk()
        ->viewData('page')['props'];
}

it('records the start of a retro, of a poker game and the creation of a whiteboard, by their creator', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $scope = [$team->workspace, $team];

    $this->actingAs($member)->post(route('teams.retros.store', $scope), ['title' => 'Sprint 42 retro', 'template' => 'start_stop_continue']);
    expect(lastActivity($team))->kind->toBe(TeamActivityKind::RetroStarted)->actor_user_id->toBe($member->id)->subject_title->toBe('Sprint 42 retro');

    $this->travel(1)->seconds();
    $this->actingAs($member)->post(route('teams.pokerGames.store', $scope), ['title' => 'Refinement', 'deck' => 'fibonacci']);
    expect(lastActivity($team)->kind)->toBe(TeamActivityKind::PokerStarted);

    $this->travel(1)->seconds();
    $this->actingAs($member)->post(route('teams.whiteboards.store', $scope), ['title' => 'Journey']);
    expect(lastActivity($team)->kind)->toBe(TeamActivityKind::WhiteboardCreated);
});

it('records the close of a retro by its facilitator and the end of a poker game', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->create(['phase' => RetroPhase::Roti]);
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($facilitator)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertSuccessful();
    expect(lastActivity($team))->kind->toBe(TeamActivityKind::RetroCompleted)->actor_user_id->toBe($facilitator->id);

    $game = PokerGame::factory()->for($team)->create();
    [$host] = pokerFacilitator($game);

    $this->actingAs($host)->putJson(route('poker.status.update', $game), ['ended' => true])->assertSuccessful();
    $this->actingAs($host)->putJson(route('poker.status.update', $game), ['ended' => true])->assertSuccessful();

    expect(TeamActivity::query()->where('kind', TeamActivityKind::PokerEnded)->count())->toBe(1);
});

it('records publishing and closing a standalone survey, not an attached health check', function () {
    $team = Team::factory()->create();
    $survey = TeamSurvey::factory()->for($team)->create();
    surveyQuestion($survey, TeamSurveyQuestionKind::Scale);
    [$editor] = surveyFacilitator($survey);

    $this->actingAs($editor)->putJson(route('surveys.status.update', $survey), ['status' => 'open'])->assertSuccessful();
    expect(lastActivity($team)->kind)->toBe(TeamActivityKind::SurveyPublished);

    $this->travel(1)->seconds();
    $this->actingAs($editor)->putJson(route('surveys.status.update', $survey), ['status' => 'closed'])->assertSuccessful();
    expect(lastActivity($team)->kind)->toBe(TeamActivityKind::SurveyClosed);

    $retro = Retro::factory()->for($team)->create();
    $healthCheck = TeamSurvey::factory()->for($team)->create(['retro_id' => $retro->id]);
    surveyQuestion($healthCheck, TeamSurveyQuestionKind::Scale);
    [$healthCheckEditor] = surveyFacilitator($healthCheck);

    $this->actingAs($healthCheckEditor)->putJson(route('surveys.status.update', $healthCheck), ['status' => 'open'])->assertNotFound();
    expect(TeamActivity::query()->where('subject_id', $healthCheck->id)->exists())->toBeFalse();
});

it('records the completion of an action item by a member, a guest or a tracker', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $complete = function (ActionItem $item, ActionItemActor|ExternalSyncActor $actor): void {
        DB::transaction(fn () => resolve(SetActionItemStatus::class)->handle(ActionItem::query()->lockForUpdate()->findOrFail($item->id), $actor, ActionItemStatus::Completed));
    };

    $complete(ActionItem::factory()->for($team)->create(['content' => 'Fix CI', 'assignee_user_id' => $member->id]), ActionItemActor::forUser($member));
    expect(lastActivity($team))->kind->toBe(TeamActivityKind::ActionItemCompleted)->subject_title->toBe('Fix CI')->actor_user_id->toBe($member->id);

    $this->travel(1)->seconds();
    $complete(ActionItem::factory()->for($team)->create(), new ExternalSyncActor('jira', 'ATLAS-12'));
    expect(lastActivity($team))->actor_user_id->toBeNull()->actor_name->toBe('Jira');
});

it('records a member joining the team', function () {
    $team = Team::factory()->create();
    $newcomer = workspaceManager($team->workspace, WorkspaceRole::Member);

    $this->actingAs(workspaceManager($team->workspace))->post(route('teams.members.store', [$team->workspace, $team]), ['user_id' => $newcomer->id]);

    expect(lastActivity($team))->kind->toBe(TeamActivityKind::MemberJoined)->actor_user_id->toBe($newcomer->id);
});

it('records a member joining through an approved access request, once', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();
    $alreadyIn = TeamAccessRequest::factory()->for($team)->pending()->create();
    $team->members()->attach($alreadyIn->user_id);

    resolve(AnswerTeamAccessRequest::class)->handle($manager, $request, approve: true);
    resolve(AnswerTeamAccessRequest::class)->handle($manager, $alreadyIn, approve: true);

    expect(TeamActivity::query()->where('team_id', $team->id)->where('kind', TeamActivityKind::MemberJoined)->pluck('actor_user_id')->all())
        ->toBe([$request->user_id]);
});

it('records a member joining through an invite link, once', function () {
    $link = TeamInviteLink::factory()->create();
    $newcomer = User::factory()->create();

    resolve(JoinTeamByLink::class)->handle($link, $newcomer);
    resolve(JoinTeamByLink::class)->handle($link, $newcomer);

    expect(TeamActivity::query()->where('team_id', $link->team_id)->where('kind', TeamActivityKind::MemberJoined)->pluck('actor_user_id')->all())
        ->toBe([$newcomer->id]);
});

it('has the nine kinds of the spec and none about cards, votes, comments or answers', function () {
    expect(array_column(TeamActivityKind::cases(), 'value'))->toBe([
        'retro_started', 'retro_completed', 'poker_started', 'poker_ended', 'whiteboard_created',
        'survey_published', 'survey_closed', 'action_item_completed', 'member_joined',
    ]);
});

it('sends the five latest lines, newest first, with a link while the subject exists', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $record = resolve(RecordTeamActivity::class);
    $kept = Retro::factory()->for($team)->create(['title' => 'Kept']);
    $gone = Retro::factory()->for($team)->create(['title' => 'Gone']);

    foreach (range(1, 9) as $minute) {
        $this->travelTo(now()->addMinute());
        $record->handle($team->id, TeamActivityKind::MemberJoined, $member);
    }

    $this->travelTo(now()->addMinute());
    $record->handle($team->id, TeamActivityKind::RetroStarted, $member, null, $gone->id, 'Gone');
    $this->travelTo(now()->addMinute());
    $record->handle($team->id, TeamActivityKind::RetroStarted, null, null, $kept->id, 'Kept');
    $gone->delete();

    $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('activity', 5)
            ->where('activity.0.subject', ['title' => 'Kept', 'url' => route('retros.show', $kept)])
            ->where('activity.0.actor.name', 'Former member')
            ->where('activity.1.subject', ['title' => 'Gone', 'url' => null])
            ->where('activity.1.actor.name', $member->name));
});

it('puts every kind of activity in exactly one group', function () {
    $grouped = array_merge(...array_values(ListTeamActivity::Groups));

    expect(array_keys(ListTeamActivity::Groups))->toBe(['sessions', 'actions', 'members'])
        ->and(array_column($grouped, 'value'))->toEqualCanonicalizing(array_column(TeamActivityKind::cases(), 'value'));
});

it('pages 65 events by 30 with no duplicate and no gap, even when events share a second', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $start = now()->subHour()->startOfSecond();

    foreach (range(1, 65) as $index) {
        $this->travelTo($start->copy()->addSeconds(intdiv($index, 7)));
        TeamActivity::factory()->for($team)->create(['actor_user_id' => $member->id]);
    }

    $this->travelTo($start->copy()->addHour());

    $first = activityPage($team, $member);
    $second = activityPage($team, $member, ['before' => $first['nextCursor']]);
    $third = activityPage($team, $member, ['before' => $second['nextCursor']]);
    $seen = array_column([...$first['lines'], ...$second['lines'], ...$third['lines']], 'id');
    $newestFirst = TeamActivity::query()->where('team_id', $team->id)->latest()->orderByDesc('id')->pluck('id')->all();

    expect($first['lines'])->toHaveCount(30)
        ->and($second['lines'])->toHaveCount(30)
        ->and($third['lines'])->toHaveCount(5)
        ->and($third['nextCursor'])->toBeNull()
        ->and([$first['total'], $second['total'], $third['total']])->toBe([65, 65, 65])
        ->and($first['lines'][29]['at'])->toBe($second['lines'][0]['at'])
        ->and($seen)->toBe($newestFirst);
});

it('keeps the kinds of a group', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    foreach (TeamActivityKind::cases() as $kind) {
        TeamActivity::factory()->for($team)->create(['kind' => $kind, 'actor_user_id' => $member->id]);
    }

    $kindsOf = fn (?string $group): array => array_column(activityPage($team, $member, ['group' => $group])['lines'], 'kind');

    expect($kindsOf(null))->toHaveCount(9)
        ->and($kindsOf('sessions'))->toEqualCanonicalizing([
            'retro_started', 'retro_completed', 'poker_started', 'poker_ended', 'whiteboard_created', 'survey_published', 'survey_closed',
        ])
        ->and($kindsOf('actions'))->toBe(['action_item_completed'])
        ->and($kindsOf('members'))->toBe(['member_joined'])
        ->and(activityPage($team, $member, ['group' => 'actions'])['total'])->toBe(1);
});

it('keeps the lines of one member, and drops a guest\'s', function () {
    $team = Team::factory()->create();
    $ada = teamMember($team);
    $max = teamMember($team);
    TeamActivity::factory()->for($team)->create(['actor_user_id' => $ada->id]);
    TeamActivity::factory()->for($team)->create(['actor_user_id' => $max->id]);
    TeamActivity::factory()->for($team)->create(['actor_name' => 'Guest Gus']);

    $page = activityPage($team, $max, ['actor' => $ada->id]);

    expect($page['total'])->toBe(1)
        ->and(array_column($page['lines'], 'actor'))->toBe([['name' => $ada->name, 'avatarUrl' => $ada->avatarUrl()]])
        ->and($page['filters'])->toBe(['group' => null, 'actor' => $ada->id, 'day' => null])
        ->and(activityPage($team, $max)['total'])->toBe(3);
});

it('keeps the lines of one day of the application\'s time zone', function () {
    config(['app.timezone' => 'Europe/Paris']);
    date_default_timezone_set('Europe/Paris');

    $team = Team::factory()->create();
    $member = teamMember($team);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 23:59:30', 'Europe/Paris'));
    $before = TeamActivity::factory()->for($team)->create(['actor_user_id' => $member->id]);
    $this->travelTo(CarbonImmutable::parse('2026-10-06 00:00:30', 'Europe/Paris'));
    $after = TeamActivity::factory()->for($team)->create(['actor_user_id' => $member->id]);

    $monday = activityPage($team, $member, ['day' => '2026-10-05']);
    $tuesday = activityPage($team, $member, ['day' => '2026-10-06']);

    expect(array_column($monday['lines'], 'id'))->toBe([$before->id])
        ->and($monday['lines'][0]['day'])->toBe('2026-10-05')
        ->and($monday['total'])->toBe(1)
        ->and(array_column($tuesday['lines'], 'id'))->toBe([$after->id])
        ->and($tuesday['lines'][0]['day'])->toBe('2026-10-06')
        ->and($tuesday['today'])->toBe('2026-10-06')
        ->and(activityPage($team, $member, ['day' => '2026-10-07'])['lines'])->toBe([]);
});

it('combines the filters and keeps them through the next page', function () {
    $team = Team::factory()->create();
    $ada = teamMember($team);
    $max = teamMember($team);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:00', (string) config('app.timezone')));
    TeamActivity::factory()->for($team)->count(35)->create(['kind' => TeamActivityKind::RetroStarted, 'actor_user_id' => $ada->id]);
    TeamActivity::factory()->for($team)->create(['kind' => TeamActivityKind::RetroStarted, 'actor_user_id' => $max->id]);
    TeamActivity::factory()->for($team)->create(['kind' => TeamActivityKind::MemberJoined, 'actor_user_id' => $ada->id]);
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00', (string) config('app.timezone')));
    TeamActivity::factory()->for($team)->create(['kind' => TeamActivityKind::RetroStarted, 'actor_user_id' => $ada->id]);

    $filters = ['group' => 'sessions', 'actor' => $ada->id, 'day' => '2026-10-05'];
    $first = activityPage($team, $max, $filters);
    $second = activityPage($team, $max, [...$filters, 'before' => $first['nextCursor']]);
    $lines = [...$first['lines'], ...$second['lines']];

    expect($first['lines'])->toHaveCount(30)
        ->and($second['lines'])->toHaveCount(5)
        ->and($second['nextCursor'])->toBeNull()
        ->and([$first['total'], $second['total']])->toBe([35, 35])
        ->and($second['filters'])->toBe($filters)
        ->and(array_unique(array_column($lines, 'id')))->toHaveCount(35)
        ->and(array_unique(array_column($lines, 'kind')))->toBe(['retro_started'])
        ->and(array_unique(array_column($lines, 'day')))->toBe(['2026-10-05']);
});

it('sends the Activity page the members of the team by name, for its person filter', function () {
    $team = Team::factory()->create();
    $zoe = teamMember($team);
    $zoe->update(['name' => 'Zoe Zed']);
    $ada = teamMember($team);
    $ada->update(['name' => 'ada admin']);

    $this->actingAs($zoe)->get(route('teams.activity.index', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/activity')
            ->where('team', ['id' => $team->id, 'name' => $team->name])
            ->where('members', [
                ['id' => $ada->id, 'name' => 'ada admin', 'avatarUrl' => $ada->avatarUrl()],
                ['id' => $zoe->id, 'name' => 'Zoe Zed', 'avatarUrl' => $zoe->avatarUrl()],
            ])
            ->where('lines', [])
            ->where('total', 0)
            ->where('nextCursor', null)
            ->where('filters', ['group' => null, 'actor' => null, 'day' => null]));
});

it('lists in the person filter a workspace manager who acted in the team without being a member', function () {
    $team = Team::factory()->create();
    $max = teamMember($team);
    $max->update(['name' => 'Max Member']);
    $ada = workspaceManager($team->workspace);
    $ada->update(['name' => 'ada admin']);
    $elsewhere = workspaceManager($team->workspace, WorkspaceRole::Member);
    TeamActivity::factory()->for($team)->count(2)->create(['actor_user_id' => $ada->id]);
    TeamActivity::factory()->for($team)->create(['actor_user_id' => $max->id]);
    TeamActivity::factory()->for($team)->create(['actor_name' => 'Guest Gus']);
    TeamActivity::factory()->for(Team::factory()->for($team->workspace))->create(['actor_user_id' => $elsewhere->id]);

    expect(activityPage($team, $max)['members'])->toBe([
        ['id' => $ada->id, 'name' => 'ada admin', 'avatarUrl' => $ada->avatarUrl()],
        ['id' => $max->id, 'name' => 'Max Member', 'avatarUrl' => $max->avatarUrl()],
    ]);
});

it('filters to the lines of someone who acted in the team without being a member', function () {
    $team = Team::factory()->create();
    $max = teamMember($team);
    $ada = workspaceManager($team->workspace);
    TeamActivity::factory()->for($team)->count(2)->create(['actor_user_id' => $ada->id]);
    TeamActivity::factory()->for($team)->create(['actor_user_id' => $max->id]);

    $page = activityPage($team, $max, ['actor' => $ada->id]);

    expect($page['total'])->toBe(2)
        ->and(array_unique(array_column(array_column($page['lines'], 'actor'), 'name')))->toBe([$ada->name])
        ->and($page['filters']['actor'])->toBe($ada->id);
});

it('still refuses an id that is neither a member nor an actor of the team', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $elsewhere = workspaceManager($team->workspace, WorkspaceRole::Member);
    TeamActivity::factory()->for(Team::factory()->for($team->workspace))->create(['actor_user_id' => $elsewhere->id]);

    $this->actingAs($member)
        ->get(route('teams.activity.index', [$team->workspace, $team, 'actor' => $elsewhere->id]))
        ->assertSessionHasErrors('actor');
});

it('refuses an unknown group, an actor who is not in the team and a malformed day', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $outsider = workspaceManager($team->workspace, WorkspaceRole::Member);
    $visit = fn (array $query) => $this->actingAs($member)->get(route('teams.activity.index', [$team->workspace, $team, ...$query]));

    $visit(['group' => 'cards'])->assertSessionHasErrors('group');
    $visit(['actor' => $outsider->id])->assertSessionHasErrors('actor');
    $visit(['actor' => 'someone'])->assertSessionHasErrors('actor');
    $visit(['day' => '06/10/2026'])->assertSessionHasErrors('day');
    $visit(['day' => '2026-02-30'])->assertSessionHasErrors('day');
    $visit(['before' => str_repeat('x', 81)])->assertSessionHasErrors('before');
});

it('refuses a user who cannot view the team', function () {
    $team = Team::factory()->create();

    $this->actingAs(workspaceManager($team->workspace, WorkspaceRole::Member))
        ->get(route('teams.activity.index', [$team->workspace, $team]))
        ->assertForbidden();
});
