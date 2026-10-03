<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\Teams\AnswerTeamAccessRequest;
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
use App\Models\TeamSurvey;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

function lastActivity(Team $team): TeamActivity
{
    return TeamActivity::query()->where('team_id', $team->id)->latest()->orderByDesc('id')->firstOrFail();
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

it('has the nine kinds of the spec and none about cards, votes, comments or answers', function () {
    expect(array_column(TeamActivityKind::cases(), 'value'))->toBe([
        'retro_started', 'retro_completed', 'poker_started', 'poker_ended', 'whiteboard_created',
        'survey_published', 'survey_closed', 'action_item_completed', 'member_joined',
    ]);
});

it('sends the ten latest lines, newest first, with a link while the subject exists', function () {
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
            ->has('activity', 10)
            ->where('activity.0.subject', ['title' => 'Kept', 'url' => route('retros.show', $kept)])
            ->where('activity.0.actor.name', 'Former member')
            ->where('activity.1.subject', ['title' => 'Gone', 'url' => null])
            ->where('activity.1.actor.name', $member->name));
});
