<?php

use App\Actions\Retros\BuildResults;
use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;

it('counts observers neither among who joined nor among who was expected', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->create(['phase' => RetroPhase::Completed]);
    $member = teamMember($team);
    teamMember($team);
    $observer = teamMember($team, TeamRole::Observer);
    $viewer = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $member->id]);
    Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $observer->id]);
    Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $participation = resolve(BuildResults::class)->handle($retro->fresh(), $viewer)['stats']['participation'];

    expect($participation)->toBe(['participants' => 2, 'expected' => 3]);
});

it('leaves observers out of a survey audience', function () {
    $team = Team::factory()->create();
    $survey = TeamSurvey::factory()->for($team)->open()->create();
    teamMember($team);
    teamMember($team, TeamRole::Observer);

    expect($survey->fresh()->audienceCount())->toBe(1);
});

it('leaves an observer who opened a survey out of who joined it', function () {
    $team = Team::factory()->create();
    $survey = TeamSurvey::factory()->for($team)->open()->create();
    $member = teamMember($team);
    $observer = teamMember($team, TeamRole::Observer);
    TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id, 'user_id' => $member->id]);
    TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id, 'user_id' => $observer->id]);

    expect($survey->fresh()->participantCount())->toBe(1)
        ->and($survey->fresh()->audienceCount())->toBe(1);
});

it('counts a workspace admin whose team row says observer as a participant', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->create(['phase' => RetroPhase::Completed]);
    $survey = TeamSurvey::factory()->for($team)->open()->create();
    $member = teamMember($team);
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin, ['role' => TeamRole::Observer->value]);
    $viewer = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $member->id]);
    Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $admin->id]);
    TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id, 'user_id' => $admin->id]);

    $participation = resolve(BuildResults::class)->handle($retro->fresh(), $viewer)['stats']['participation'];

    expect($participation)->toBe(['participants' => 2, 'expected' => 2])
        ->and($survey->fresh()->audienceCount())->toBe(2)
        ->and($survey->fresh()->participantCount())->toBe(1);
});
