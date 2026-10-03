<?php

use App\Enums\TeamSurveyQuestionKind;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Events\TeamSurveys\TeamSurveyResponsesChanged;
use App\Models\TeamSurvey;
use Illuminate\Broadcasting\PresenceChannel;

it('announces a change with a version and a status, nothing else', function () {
    $survey = TeamSurvey::factory()->open()->create(['version' => 7]);

    $event = TeamSurveyChanged::for($survey);

    expect($event->broadcastAs())->toBe('survey.changed')
        ->and($event->broadcastWith())->toBe(['version' => 7, 'status' => 'open'])
        ->and($event->broadcastOn())->toBeInstanceOf(PresenceChannel::class)
        ->and($event->broadcastOn()->name)->toBe("presence-survey.{$survey->id}");
});

it('announces answers with two counts and never an answer, an aggregate or a respondent', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $question = surveyQuestion($survey, TeamSurveyQuestionKind::Text);
    [, $first] = surveyMember($survey);
    [, $second] = surveyMember($survey);
    answerSurveyQuestion($question, $first, 'a very recognisable sentence');
    answerSurveyQuestion($question, $second, 'another one');
    $second->update(['completed_at' => now()]);

    $payload = TeamSurveyResponsesChanged::for($survey)->broadcastWith();

    expect($payload)->toBe(['responses' => 2, 'completed' => 1])
        ->and(json_encode($payload))->not->toContain('recognisable')
        ->and(json_encode($payload))->not->toContain($first->id);
});
