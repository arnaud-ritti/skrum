<?php

use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

it('lists the team\'s surveys, newest first, with their counts', function () {
    $team = Team::factory()->create();
    $older = TeamSurvey::factory()->closed()->create(['team_id' => $team->id, 'title' => 'Older', 'updated_at' => now()->subDay()]);
    $newer = TeamSurvey::factory()->open()->create(['team_id' => $team->id, 'title' => 'Newer']);
    [$facilitator, $respondent] = surveyFacilitator($newer);
    $question = surveyQuestion($newer);
    surveyQuestion($newer);
    answerSurveyQuestion($question, $respondent, 3);

    $this->actingAs($facilitator)->get(route('teams.show', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canCreateSurvey', true)
            ->has('surveys', 2)
            ->where('surveys.0.title', 'Newer')
            ->where('surveys.0.status', 'open')
            ->where('surveys.0.questionCount', 2)
            ->where('surveys.0.responseCount', 1)
            ->where('surveys.0.canManage', true)
            ->where('surveys.0.url', route('surveys.results.show', $newer, absolute: false))
            ->where('surveys.1.id', $older->id)
            ->where('surveys.1.canManage', false)
            ->has('surveyTemplates', 4)
            ->where('surveyTemplates.1.key', 'health_check')
            ->where('surveyTemplates.1.questionCount', 6));
});

it('lists a draft for its editors only, and never a survey attached to a retro', function () {
    $team = Team::factory()->create();
    $draft = TeamSurvey::factory()->create(['team_id' => $team->id]);
    [$facilitator] = surveyFacilitator($draft);
    TeamSurvey::factory()->attachedTo(Retro::factory()->for($team)->create())->open()->create();
    $member = teamMember($team);

    $this->actingAs($facilitator)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->has('surveys', 1)->where('surveys.0.url', route('surveys.edit', $draft, absolute: false)));
    $this->actingAs(workspaceManager($team->workspace))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->has('surveys', 1));
    $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->has('surveys', 0));
});

it('does not grow the number of queries with the number of surveys', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $seed = function (int $count) use ($team): void {
        TeamSurvey::factory()->count($count)->open()->create(['team_id' => $team->id])
            ->each(function (TeamSurvey $survey): void {
                [, $respondent] = surveyFacilitator($survey);
                answerSurveyQuestion(surveyQuestion($survey), $respondent, 3);
            });
    };
    $countQueries = function () use ($team, $member): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]))->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };
    warmInstanceSettings();

    $seed(1);
    $countQueries();
    $withOne = $countQueries();

    $seed(4);

    expect($countQueries())->toBe($withOne);
});
