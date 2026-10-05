<?php

use App\Enums\SurveyKind;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyOption;
use App\Models\SurveyReaction;
use App\Models\SurveyResponse;
use App\Models\SurveyTextAnswer;

it('orders a retro surveys and their options by position', function () {
    $retro = Retro::factory()->create();
    $second = Survey::factory()->create(['retro_id' => $retro->id, 'position' => 1]);
    $first = Survey::factory()->withOptions(['A', 'B'])->create(['retro_id' => $retro->id, 'position' => 0]);

    expect($retro->surveys()->pluck('id')->all())->toBe([$first->id, $second->id])
        ->and($first->options()->pluck('label')->all())->toBe(['A', 'B'])
        ->and($first->fresh()->kind)->toBe(SurveyKind::Single);
});

it('counts respondents once and knows who answered', function () {
    $survey = Survey::factory()->multiple()->withOptions()->create();
    $voter = Participant::factory()->create(['retro_id' => $survey->retro_id]);
    $other = Participant::factory()->create(['retro_id' => $survey->retro_id]);

    foreach ($survey->options->take(2) as $option) {
        SurveyResponse::factory()->create(['survey_id' => $survey->id, 'survey_option_id' => $option->id, 'participant_id' => $voter->id]);
    }

    expect($survey->responseCount())->toBe(1)
        ->and($survey->hasAnswerFrom($voter))->toBeTrue()
        ->and($survey->hasAnswerFrom($other))->toBeFalse()
        ->and($survey->isVisibleTo($other))->toBeFalse()
        ->and($survey->answeredParticipantIds()->all())->toBe([$voter->id]);

    $survey->update(['is_closed' => true]);

    expect($survey->isVisibleTo($other))->toBeTrue();
});

it('counts free-text respondents and live comments', function () {
    $survey = Survey::factory()->text()->create();
    SurveyTextAnswer::factory()->count(2)->create(['survey_id' => $survey->id]);
    SurveyComment::factory()->create(['retro_id' => $survey->retro_id, 'survey_id' => $survey->id]);
    SurveyComment::factory()->create(['retro_id' => $survey->retro_id, 'survey_id' => $survey->id, 'content' => null, 'deleted_at' => now()]);

    expect($survey->responseCount())->toBe(2)
        ->and($survey->commentCount())->toBe(1);
});

it('deletes surveys with everything attached when the retro is deleted', function () {
    $survey = Survey::factory()->withOptions()->create();
    SurveyResponse::factory()->create(['survey_id' => $survey->id, 'survey_option_id' => $survey->options->first()->id]);
    SurveyTextAnswer::factory()->create(['survey_id' => $survey->id]);
    SurveyReaction::factory()->create(['retro_id' => $survey->retro_id, 'survey_id' => $survey->id]);
    SurveyComment::factory()->create(['retro_id' => $survey->retro_id, 'survey_id' => $survey->id]);

    $survey->retro->delete();

    expect(Survey::count())->toBe(0)
        ->and(SurveyOption::count())->toBe(0)
        ->and(SurveyResponse::count())->toBe(0)
        ->and(SurveyTextAnswer::count())->toBe(0)
        ->and(SurveyReaction::count())->toBe(0)
        ->and(SurveyComment::count())->toBe(0);
});

it('applies the spec defaults to a freshly created survey', function () {
    $survey = Survey::factory()->create();

    expect($survey->is_closed)->toBeFalse()
        ->and($survey->show_voters)->toBeFalse()
        ->and($survey->version)->toBe(1);
});

it('lists comments posted in the same second in the order of their ids', function () {
    $survey = Survey::factory()->create();
    $postedAt = now()->startOfSecond();

    SurveyComment::factory()->create(['id' => '0199c000-0000-7000-8000-000000000002', 'survey_id' => $survey->id, 'retro_id' => $survey->retro_id, 'content' => 'Same here', 'created_at' => $postedAt]);
    SurveyComment::factory()->create(['id' => '0199c000-0000-7000-8000-000000000001', 'survey_id' => $survey->id, 'retro_id' => $survey->retro_id, 'content' => 'Pairing saved us', 'created_at' => $postedAt]);

    expect($survey->comments()->pluck('content')->all())->toBe(['Pairing saved us', 'Same here']);
});
