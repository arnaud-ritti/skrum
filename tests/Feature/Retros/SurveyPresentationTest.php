<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Actions\Surveys\PresentSurvey;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyReaction;
use App\Models\SurveyTextAnswer;
use Illuminate\Support\Facades\DB;

function presentedSurvey(Survey $survey, Participant $viewer): array
{
    $fresh = $survey->fresh();

    return resolve(PresentSurvey::class)->handle($fresh, $fresh->retro, $viewer);
}

function surveyAudience(array $retroAttributes = []): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create($retroAttributes);
    [, $viewer] = retroMember($retro);
    [, $other] = retroMember($retro);

    return [$retro, $viewer, $other];
}

it('hides counts and voters until the viewer answers', function () {
    [$retro, $viewer, $other] = surveyAudience();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, 'show_voters' => true]);
    answerSurvey($survey, $other, 0);

    $hidden = presentedSurvey($survey, $viewer);

    expect($hidden)->toMatchArray(['resultsVisible' => false, 'responseCount' => 1, 'myOptionIds' => [], 'myText' => null, 'showVoters' => true])
        ->and(collect($hidden['options'])->pluck('count')->all())->toBe([null, null, null])
        ->and(collect($hidden['options'])->pluck('voters')->all())->toBe([null, null, null])
        ->and(json_encode($hidden))->not->toContain($other->id);

    answerSurvey($survey, $viewer, 1);

    $visible = presentedSurvey($survey, $viewer);

    expect($visible['resultsVisible'])->toBeTrue()
        ->and($visible['myOptionIds'])->toBe([$survey->options[1]->id])
        ->and(collect($visible['options'])->pluck('count')->all())->toBe([1, 1, 0])
        ->and($visible['options'][0]['voters'])->toBe([$other->id])
        ->and($visible['options'][1]['voters'])->toBe([$viewer->id]);
});

it('shows counts to everyone once the survey is closed', function () {
    [$retro, $viewer, $other] = surveyAudience();
    $survey = Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id]);
    answerSurvey($survey, $other, 2);

    $payload = presentedSurvey($survey, $viewer);

    expect($payload['resultsVisible'])->toBeTrue()
        ->and($payload['isClosed'])->toBeTrue()
        ->and(collect($payload['options'])->pluck('count')->all())->toBe([0, 0, 1]);
});

it('never links a participant to an option when show who answered is off', function () {
    [$retro, $viewer, $other] = surveyAudience();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    answerSurvey($survey, $other, 0);
    answerSurvey($survey, $viewer, 0);

    $payload = presentedSurvey($survey, $viewer);

    expect($payload['showVoters'])->toBeFalse()
        ->and(collect($payload['options'])->pluck('voters')->all())->toBe([null, null, null])
        ->and(json_encode($payload))->not->toContain($other->id);
});

it('never sends voters, text authors or reaction names on anonymous retros', function () {
    [$retro, $viewer, $other] = surveyAudience(['is_anonymous' => true]);
    $choice = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, 'show_voters' => true]);
    $text = Survey::factory()->text()->create(['retro_id' => $retro->id, 'show_voters' => true, 'position' => 1]);
    answerSurvey($choice, $other, 0);
    answerSurvey($choice, $viewer, 0);
    SurveyTextAnswer::factory()->create(['survey_id' => $text->id, 'participant_id' => $other->id, 'content' => 'Theirs']);
    SurveyTextAnswer::factory()->create(['survey_id' => $text->id, 'participant_id' => $viewer->id, 'content' => 'Mine']);
    SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $choice->id, 'participant_id' => $other->id]);

    $choicePayload = presentedSurvey($choice, $viewer);
    $textPayload = presentedSurvey($text, $viewer);

    expect($choicePayload['showVoters'])->toBeFalse()
        ->and($choicePayload['options'][0]['voters'])->toBeNull()
        ->and($choicePayload['reactions'][0]['names'])->toBe([])
        ->and(collect($textPayload['textAnswers'])->pluck('authorId')->all())->toBe([null, null])
        ->and(json_encode([$choicePayload, $textPayload]))->not->toContain($other->id);
});

it('counts multiple choice answers per option and each respondent once', function () {
    [$retro, $viewer, $other] = surveyAudience();
    $survey = Survey::factory()->multiple()->withOptions()->create(['retro_id' => $retro->id]);
    answerSurvey($survey, $other, 0, 1);
    answerSurvey($survey, $viewer, 1);

    $payload = presentedSurvey($survey, $viewer);

    expect($payload['kind'])->toBe('multiple')
        ->and($payload['responseCount'])->toBe(2)
        ->and($payload['myOptionIds'])->toBe([$survey->options[1]->id])
        ->and(collect($payload['options'])->pluck('count')->all())->toBe([1, 2, 0])
        ->and($payload['textAnswers'])->toBeNull();
});

it('orders free-text answers by text and names authors only when allowed', function (bool $showVoters, bool $isAnonymous, bool $namesAuthors) {
    [$retro, $viewer, $other] = surveyAudience(['is_anonymous' => $isAnonymous]);
    [, $third] = retroMember($retro);
    $survey = Survey::factory()->text()->create(['retro_id' => $retro->id, 'show_voters' => $showVoters]);
    SurveyTextAnswer::factory()->create(['survey_id' => $survey->id, 'participant_id' => $third->id, 'content' => 'cherry']);
    SurveyTextAnswer::factory()->create(['survey_id' => $survey->id, 'participant_id' => $other->id, 'content' => 'banana']);

    expect(presentedSurvey($survey, $viewer)['textAnswers'])->toBeNull();

    SurveyTextAnswer::factory()->create(['survey_id' => $survey->id, 'participant_id' => $viewer->id, 'content' => 'Apple']);

    $payload = presentedSurvey($survey, $viewer);

    expect(collect($payload['textAnswers'])->pluck('text')->all())->toBe(['Apple', 'banana', 'cherry'])
        ->and(collect($payload['textAnswers'])->pluck('isMine')->all())->toBe([true, false, false])
        ->and($payload['myText'])->toBe('Apple')
        ->and($payload['responseCount'])->toBe(3)
        ->and($payload['textAnswers'][1]['authorId'])->toBe($namesAuthors ? $other->id : null);
})->with([
    'hidden by default' => [false, false, false],
    'shown by the facilitator' => [true, false, true],
    'never on anonymous retros' => [true, true, false],
]);

it('keeps reactions and comments for viewers who can see the results', function () {
    [$retro, $viewer, $other] = surveyAudience();
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);
    answerSurvey($survey, $other, 0);
    SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $other->id, 'emoji' => '🎉']);
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $other->id, 'content' => 'Good one']);

    $hidden = presentedSurvey($survey, $viewer);

    expect($hidden)->toMatchArray(['reactions' => [], 'comments' => [], 'commentCount' => 1])
        ->and(json_encode($hidden))->not->toContain('Good one');

    answerSurvey($survey, $viewer, 1);

    $visible = presentedSurvey($survey, $viewer);

    expect($visible['reactions'])->toBe([['emoji' => '🎉', 'count' => 1, 'mine' => false, 'names' => []]])
        ->and($visible['comments'][0])->toMatchArray([
            'surveyId' => $survey->id,
            'content' => 'Good one',
            'author' => ['id' => $other->id, 'name' => $other->displayName()],
        ]);
});

it('names reactions only when show who answered is on', function () {
    [$retro, $viewer, $other] = surveyAudience();
    $survey = Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id, 'show_voters' => true]);
    SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $other->id]);

    expect(presentedSurvey($survey, $viewer)['reactions'][0]['names'])->toBe([$other->displayName()]);
});

it('hides comment authors on anonymous retros', function () {
    [$retro, $viewer, $other] = surveyAudience(['is_anonymous' => true]);
    $survey = Survey::factory()->closed()->withOptions()->create(['retro_id' => $retro->id]);
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $survey->id, 'participant_id' => $other->id]);

    $payload = presentedSurvey($survey, $viewer);

    expect($payload['comments'][0]['author'])->toBeNull()
        ->and(json_encode($payload))->not->toContain($other->id);
});

it('adds surveys to the snapshot in order with a constant number of queries', function () {
    warmInstanceSettings();
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $viewer] = retroMember($retro);

    $seed = function (int $count) use ($retro, $viewer): void {
        foreach (range(1, $count) as $index) {
            $position = (int) $retro->surveys()->max('position') + 1;
            $choice = Survey::factory()->withOptions()->create(['retro_id' => $retro->id, 'position' => $position]);
            $text = Survey::factory()->text()->create(['retro_id' => $retro->id, 'position' => $position + 1]);
            answerSurvey($choice, $viewer, 0);
            SurveyTextAnswer::factory()->create(['survey_id' => $text->id, 'participant_id' => $viewer->id]);
            SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $choice->id]);
            $thread = SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $choice->id]);
            SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $choice->id, 'parent_comment_id' => $thread->id]);
        }
    };

    $countQueries = function () use ($retro, $viewer): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(1);
    $small = $countQueries();

    $seed(4);

    $positions = collect(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['surveys'])->pluck('position')->all();

    expect($countQueries())->toBe($small)
        ->and($positions)->toBe(collect($positions)->sort()->values()->all())
        ->and($positions)->toHaveCount(10);
});
