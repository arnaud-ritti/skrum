<?php

use App\Actions\TeamSurveys\CompareSurveys;
use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyStatus;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;

/**
 * @param  array<int, int|string|array<int, int>>  $answers
 */
function answeredBy(TeamSurveyQuestion $question, array $answers): void
{
    foreach ($answers as $answer) {
        [, $respondent] = surveyMember($question->survey);
        answerSurveyQuestion($question, $respondent, $answer);
    }
}

function closedSurvey(Team $team, string $closedAt, array $attributes = []): TeamSurvey
{
    return TeamSurvey::factory()->closed()->withoutThreshold()->create(['team_id' => $team->id, 'closed_at' => $closedAt, ...$attributes]);
}

it('pairs questions by key, then by kind and label, and gives each difference', function () {
    $team = Team::factory()->create();
    $before = closedSurvey($team, '2026-09-01 10:00:00', ['title' => 'Sprint 41']);
    $now = closedSurvey($team, '2026-10-01 10:00:00', ['previous_survey_id' => $before->id]);

    answeredBy(surveyQuestion($before, TeamSurveyQuestionKind::Scale, ['match_key' => 'workload', 'label' => 'Old wording']), [3, 3]);
    answeredBy(surveyQuestion($now, TeamSurveyQuestionKind::Scale, ['match_key' => 'workload', 'label' => 'New wording']), [4, 5]);
    answeredBy(surveyQuestion($before, TeamSurveyQuestionKind::Nps, ['match_key' => null, 'label' => 'Recommend us? ']), [0, 10]);
    answeredBy(surveyQuestion($now, TeamSurveyQuestionKind::Nps, ['match_key' => null, 'label' => ' recommend US?']), [10, 10]);
    answeredBy(surveyQuestion($before, TeamSurveyQuestionKind::Single, ['match_key' => 'ritual'], ['Retro', 'Daily']), [[0], [1]]);
    answeredBy($ritual = surveyQuestion($now, TeamSurveyQuestionKind::Single, ['match_key' => 'ritual'], ['Retro', 'Demo']), [[0], [0]]);
    surveyQuestion($before, TeamSurveyQuestionKind::Text, ['match_key' => 'left', 'label' => 'Dropped']);
    surveyQuestion($now, TeamSurveyQuestionKind::Text, ['match_key' => 'new', 'label' => 'Added']);

    $comparison = resolve(CompareSurveys::class)->handle($now, $before);
    $pairs = collect($comparison['pairs'])->keyBy('kind');

    expect($comparison['other'])->toMatchArray(['id' => $before->id, 'title' => 'Sprint 41'])
        ->and($comparison['belowThreshold'])->toBeFalse()
        ->and($pairs['scale'])->toMatchArray(['label' => 'New wording', 'delta' => 1.5])
        ->and($pairs['scale']['current'])->toMatchArray(['mean' => 4.5, 'responses' => 2])
        ->and($pairs['scale']['other'])->toMatchArray(['mean' => 3.0, 'responses' => 2])
        ->and($pairs['nps']['delta'])->toBe(100)
        ->and($pairs['single']['delta'])->toBe([['optionId' => $ritual->options()->where('label', 'Retro')->value('id'), 'label' => 'Retro', 'delta' => 50]])
        ->and(array_column($pairs['single']['current']['options'], 'id'))->toBe($ritual->options()->orderBy('position')->pluck('id')->all())
        ->and(array_column($comparison['onlyHere'], 'label'))->toBe(['Added'])
        ->and(array_column($comparison['onlyThere'], 'label'))->toBe(['Dropped']);
});

it('gives the share of each value of a scale and of an NPS on both sides, to draw them in one chart', function () {
    $team = Team::factory()->create();
    $before = closedSurvey($team, '2026-09-01 10:00:00');
    $now = closedSurvey($team, '2026-10-01 10:00:00');
    answeredBy(surveyQuestion($before, TeamSurveyQuestionKind::Scale, ['match_key' => 'workload']), [3, 3, 4, 5]);
    answeredBy(surveyQuestion($now, TeamSurveyQuestionKind::Scale, ['match_key' => 'workload']), [4, 5]);
    answeredBy(surveyQuestion($before, TeamSurveyQuestionKind::Nps, ['match_key' => 'nps']), [0, 10, 10]);
    answeredBy(surveyQuestion($now, TeamSurveyQuestionKind::Nps, ['match_key' => 'nps']), [9]);

    $pairs = collect(resolve(CompareSurveys::class)->handle($now, $before)['pairs'])->keyBy('kind');
    $percents = fn (array $side): array => array_column($side['shares'], 'percent', 'key');

    expect($percents($pairs['scale']['current']))->toBe(['1' => 0, '2' => 0, '3' => 0, '4' => 50, '5' => 50])
        ->and($percents($pairs['scale']['other']))->toBe(['1' => 0, '2' => 0, '3' => 50, '4' => 25, '5' => 25])
        ->and($pairs['scale']['current']['shares'][0])->toBe(['key' => '1', 'label' => '1', 'percent' => 0])
        ->and($percents($pairs['nps']['current']))->toHaveCount(11)
        ->and($percents($pairs['nps']['current'])['9'])->toBe(100)
        ->and($percents($pairs['nps']['other'])['0'])->toBe(33)
        ->and($percents($pairs['nps']['other'])['10'])->toBe(67);
});

it('compares with the source by default, and a health check with the team\'s previous closed health check', function () {
    $team = Team::factory()->create();
    $source = closedSurvey($team, '2026-08-01 10:00:00');
    $copy = closedSurvey($team, '2026-09-01 10:00:00', ['previous_survey_id' => $source->id]);
    $firstHealth = TeamSurvey::factory()->healthCheck()->closed()->create(['team_id' => $team->id, 'closed_at' => '2026-07-01 10:00:00']);
    $secondHealth = TeamSurvey::factory()->healthCheck()->closed()->create(['team_id' => $team->id, 'closed_at' => '2026-09-15 10:00:00']);
    $openHealth = TeamSurvey::factory()->healthCheck()->open()->create(['team_id' => $team->id]);
    $compare = resolve(CompareSurveys::class);

    expect($compare->defaultFor($copy)?->id)->toBe($source->id)
        ->and($compare->defaultFor($secondHealth)?->id)->toBe($firstHealth->id)
        ->and($compare->defaultFor($openHealth)?->id)->toBe($secondHealth->id)
        ->and($compare->defaultFor($firstHealth))->toBeNull()
        ->and($compare->defaultFor($source))->toBeNull();
});

it('serves the comparison to a member who sees the results, and lists what can be compared', function () {
    $team = Team::factory()->create();
    $before = closedSurvey($team, '2026-09-01 10:00:00', ['title' => 'Sprint 41']);
    $now = closedSurvey($team, '2026-10-01 10:00:00', ['previous_survey_id' => $before->id]);
    $member = teamMember($team);

    $this->actingAs($member)->getJson(route('surveys.comparison.show', $now))
        ->assertOk()
        ->assertJsonPath('comparison.other.id', $before->id);

    $this->actingAs($member)->getJson(route('surveys.snapshot.show', $now))
        ->assertJsonPath('comparable.defaultId', $before->id)
        ->assertJsonPath('comparable.surveys.0.title', 'Sprint 41');
});

it('lists the default survey to compare with even when it closed before the twenty latest', function () {
    $team = Team::factory()->create();
    $source = closedSurvey($team, '2026-01-01 10:00:00', ['title' => 'The source']);
    $now = closedSurvey($team, '2026-10-01 10:00:00', ['previous_survey_id' => $source->id]);

    foreach (range(1, 20) as $day) {
        closedSurvey($team, sprintf('2026-09-%02d 10:00:00', $day));
    }

    $surveys = $this->actingAs(teamMember($team))->getJson(route('surveys.snapshot.show', $now))
        ->assertJsonPath('comparable.defaultId', $source->id)
        ->json('comparable.surveys');

    expect($surveys)->toHaveCount(21)
        ->and(array_column($surveys, 'id'))->toContain($source->id);
});

it('answers with no comparison when there is nothing to compare with', function () {
    $survey = closedSurvey(Team::factory()->create(), '2026-10-01 10:00:00');

    $this->actingAs(teamMember($survey->team))->getJson(route('surveys.comparison.show', $survey))
        ->assertOk()
        ->assertJsonPath('comparison', null);
});

it('refuses a survey of another team, an open one, a viewer without results, and a guest', function () {
    $team = Team::factory()->create();
    $now = closedSurvey($team, '2026-10-01 10:00:00', ['guest_access_enabled' => true]);
    $foreign = closedSurvey(Team::factory()->create(), '2026-09-01 10:00:00');
    $open = TeamSurvey::factory()->open()->create(['team_id' => $team->id]);
    $member = teamMember($team);

    $this->actingAs($member)->getJson(route('surveys.comparison.show', [$now, 'with' => $foreign->id]))->assertNotFound();
    $this->actingAs($member)->getJson(route('surveys.comparison.show', [$now, 'with' => $open->id]))->assertNotFound();
    $this->actingAs($member)->getJson(route('surveys.comparison.show', [$open, 'with' => $now->id]))->assertForbidden();

    auth()->logout();
    $guest = surveyGuest($now);
    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.comparison.show', $now))
        ->assertForbidden();
    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $now))
        ->assertJsonPath('comparable', null);
});

it('gives no value of the other survey while it is below its threshold', function () {
    $team = Team::factory()->create();
    $before = TeamSurvey::factory()->closed()->create(['team_id' => $team->id, 'closed_at' => '2026-09-01 10:00:00']);
    $now = closedSurvey($team, '2026-10-01 10:00:00');
    answeredBy(surveyQuestion($before, TeamSurveyQuestionKind::Scale, ['match_key' => 'k']), [5]);
    answeredBy(surveyQuestion($now, TeamSurveyQuestionKind::Scale, ['match_key' => 'k']), [3]);

    $comparison = resolve(CompareSurveys::class)->handle($now, $before);

    expect($comparison['belowThreshold'])->toBeTrue()
        ->and($comparison['pairs'])->toBe([]);
});

it('pairs two questions built apart when their kind and label are the same', function () {
    $team = Team::factory()->create();
    $before = TeamSurvey::factory()->withoutThreshold()->create(['team_id' => $team->id]);
    $now = TeamSurvey::factory()->withoutThreshold()->create(['team_id' => $team->id]);
    [$beforeFacilitator] = surveyFacilitator($before);
    [$nowFacilitator] = surveyFacilitator($now);

    $this->actingAs($beforeFacilitator)->postJson(route('surveys.questions.store', $before), ['kind' => 'scale', 'label' => 'How was the sprint?', 'options' => []])->assertCreated();
    $this->actingAs($nowFacilitator)->postJson(route('surveys.questions.store', $now), ['kind' => 'scale', 'label' => 'How was the sprint? ', 'options' => []])->assertCreated();
    $before->update(['status' => TeamSurveyStatus::Closed, 'closed_at' => '2026-09-01 10:00:00']);
    $now->update(['status' => TeamSurveyStatus::Closed, 'closed_at' => '2026-10-01 10:00:00']);
    answeredBy($before->questions()->sole(), [2, 4]);
    answeredBy($now->questions()->sole(), [5, 5]);

    $comparison = resolve(CompareSurveys::class)->handle($now->fresh(), $before->fresh());

    expect($comparison['pairs'])->toHaveCount(1)
        ->and($comparison['pairs'][0]['delta'])->toBe(2.0)
        ->and($comparison['onlyHere'])->toBe([])
        ->and($comparison['onlyThere'])->toBe([]);
});

it('pairs by key before it tries the labels', function () {
    $team = Team::factory()->create();
    $before = closedSurvey($team, '2026-09-01 10:00:00');
    $now = closedSurvey($team, '2026-10-01 10:00:00');
    $renamed = surveyQuestion($before, TeamSurveyQuestionKind::Scale, ['match_key' => 'mood', 'label' => 'Energy']);
    $keyed = surveyQuestion($before, TeamSurveyQuestionKind::Scale, ['match_key' => 'energy', 'label' => 'Energy']);
    $sameLabel = surveyQuestion($now, TeamSurveyQuestionKind::Scale, ['match_key' => 'fresh', 'label' => 'Energy']);
    $sameKey = surveyQuestion($now, TeamSurveyQuestionKind::Scale, ['match_key' => 'energy', 'label' => 'Energy level']);

    $pairs = collect(resolve(CompareSurveys::class)->handle($now, $before)['pairs'])->pluck('otherQuestionId', 'questionId');

    expect($pairs[$sameKey->id])->toBe($keyed->id)
        ->and($pairs[$sameLabel->id])->toBe($renamed->id);
});
