<?php

use App\Actions\TeamSurveys\CreateTeamSurvey;
use App\Actions\TeamSurveys\NewTeamSurvey;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Tests\Browser\Support\DocsWorld;

function docsSurveysPulse(DocsWorld $world, string $title, TeamSurveyStatus $status = TeamSurveyStatus::Draft): TeamSurvey
{
    $survey = resolve(CreateTeamSurvey::class)->handle($world->team, $world->person('Théo'), new NewTeamSurvey($title, TeamSurveyTemplate::TeamPulse));

    $survey->update([
        'status' => $status,
        'opened_at' => $status === TeamSurveyStatus::Draft ? null : now(),
        'closed_at' => $status === TeamSurveyStatus::Closed ? now() : null,
    ]);

    return $survey;
}

function docsSurveysAnswer(DocsWorld $world, TeamSurvey $survey, string $firstName, int $workload, int $recommendation, int $ritual, ?string $word, int ...$blockers): void
{
    $questions = $survey->questions()->get()->values();

    $respondent = TeamSurveyRespondent::query()->firstOrCreate(['team_survey_id' => $survey->id, 'user_id' => $world->person($firstName)->id]);
    $respondent->update(['completed_at' => now()]);

    answerSurveyQuestion($questions[0], $respondent, $workload);
    answerSurveyQuestion($questions[1], $respondent, $recommendation);
    answerSurveyQuestion($questions[2], $respondent, [$ritual]);
    answerSurveyQuestion($questions[3], $respondent, $blockers);

    if ($word !== null) {
        answerSurveyQuestion($questions[4], $respondent, $word);
    }
}

function docsSurveysTwoClosedPulses(DocsWorld $world): TeamSurvey
{
    $previous = docsSurveysPulse($world, 'Team pulse · sprint 41', TeamSurveyStatus::Closed);

    docsSurveysAnswer($world, $previous, 'Camille', 3, 8, 0, 'Too many meetings on Thursday.', 0);
    docsSurveysAnswer($world, $previous, 'Théo', 3, 7, 1, null, 0);
    docsSurveysAnswer($world, $previous, 'Inès', 2, 9, 0, 'The demo put everyone under pressure.', 1, 3);
    docsSurveysAnswer($world, $previous, 'Malik', 4, 6, 0, null, 2);
    docsSurveysAnswer($world, $previous, 'Sofia', 3, 7, 2, null, 0, 3);
    docsSurveysAnswer($world, $previous, 'Noa', 3, 5, 0, 'Specifications earlier, please.', 3);
    docsSurveysAnswer($world, $previous, 'Lucas', 2, 8, 1, null, 0);

    $latest = docsSurveysPulse($world, 'Team pulse · sprint 42', TeamSurveyStatus::Closed);
    $latest->update(['previous_survey_id' => $previous->id]);

    docsSurveysAnswer($world, $latest, 'Camille', 4, 9, 0, 'Thanks for the help on the release.', 0);
    docsSurveysAnswer($world, $latest, 'Théo', 3, 10, 0, null, 0, 3);
    docsSurveysAnswer($world, $latest, 'Inès', 4, 8, 1, 'Tuesday pairing is worth keeping.', 1);
    docsSurveysAnswer($world, $latest, 'Malik', 5, 7, 2, null, 0, 2);
    docsSurveysAnswer($world, $latest, 'Sofia', 3, 9, 0, 'Fewer meetings, more focus time.', 3);
    docsSurveysAnswer($world, $latest, 'Noa', 4, 6, 3, null, 0);
    docsSurveysAnswer($world, $latest, 'Lucas', 2, 10, 0, 'The test environment is still unstable.', 2, 3);

    return $latest;
}

it('shows the ready-made surveys a new poll can start from', function () {
    $world = DocsWorld::create();
    docsSurveysPulse($world, 'Team pulse · sprint 42', TeamSurveyStatus::Closed);

    $page = $this->docsVisit($world->person('Théo'), route('teams.show', [$world->workspace, $world->team, 'new' => 'survey', 'template' => 'team_pulse'], false))
        ->assertPresent('[role="dialog"] [data-slot="survey-session-fields"]')
        ->assertAttribute('[data-slot="survey-start-choice"][data-choice="team_pulse"]', 'aria-checked', 'true')
        ->assertSeeIn('[data-slot="survey-start-choice"][data-choice="health_check"]', '6 statements · scored 1 to 5')
        ->assertSeeIn('[data-slot="survey-start-choice"][data-choice="previous"]', 'Copy the questions of an earlier survey')
        ->fill('#new-survey-title', 'Team pulse · sprint 43');

    $this->docShot($page, 'surveys/template-choice', '[role="dialog"]');
});

it('shows the builder of a Team pulse draft with its first question open, the five kinds to add and the settings', function () {
    $world = DocsWorld::create();
    $draft = docsSurveysPulse($world, 'Team pulse · sprint 43');

    $page = $this->docsVisit($world->person('Théo'), route('surveys.edit', $draft, false))
        ->assertPresent('[data-slot="survey-builder"]')
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertCount('[data-slot="survey-builder"] [data-test="survey-question"]', 5)
        ->assertValue('[data-test="survey-question"][data-open="true"] input[aria-label="Label"]', 'How do you rate the workload of this sprint?')
        ->assertPresent('[data-slot="survey-add-bar"]');

    $this->docShot($page, 'surveys/editor', '[data-slot="survey-builder"]');
    $this->docShot($page, 'surveys/question-types', '[data-slot="survey-add-bar"]');
});

it('takes a member from the Sessions page to the first question of an open Team pulse', function () {
    $world = DocsWorld::create();
    $open = docsSurveysPulse($world, 'Team pulse · sprint 43', TeamSurveyStatus::Open);

    $page = $this->docsVisit($world->person('Inès'), route('teams.sessions.index', [$world->workspace, $world->team], false))
        ->assertSee('Live now')
        ->assertPresent('[data-slot="sessions-page"] [data-slot="session-row"][data-kind="survey"]')
        ->click('[data-slot="sessions-page"] a:has-text("Join")')
        ->assertPathIs(route('surveys.results.show', $open, false))
        ->click('Answer the survey to see the results.')
        ->assertPathIs(route('surveys.show', $open, false))
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertAttribute('[data-test="survey-step"]', 'data-step', '0')
        ->assertSeeIn('[data-test="survey-step"]', 'How do you rate the workload of this sprint?');

    $this->docShot($page, 'surveys/answering', '[data-slot="survey-frame"]');
});

it('shows the summary of a closed Team pulse answered by seven people, each figure against the previous pulse', function () {
    $world = DocsWorld::create();
    $latest = docsSurveysTwoClosedPulses($world);

    $page = $this->docsVisit($world->person('Théo'), route('surveys.results.show', $latest, false))
        ->assertCount('[data-slot="survey-results-grid"] [data-slot="survey-question"]', 5)
        ->assertCount('[data-slot="survey-results-grid"] [data-slot="survey-delta"]', 2)
        ->assertNotPresent('[data-slot="survey-results-grid"] .animate-pulse');

    $this->docShot($page, 'surveys/results', '[data-slot="survey-results-grid"]');
});

it('shows the Compare tab of a closed Team pulse beside the pulse of the sprint before', function () {
    $world = DocsWorld::create();
    $latest = docsSurveysTwoClosedPulses($world);

    $page = $this->docsVisit($world->person('Théo'), route('surveys.results.show', ['teamSurvey' => $latest, 'tab' => 'compare'], false))
        ->resize(1440, 1400)
        ->assertCount('[data-slot="survey-compare-pairs"] [data-slot="survey-compare-pair"]', 5)
        ->assertNotPresent('[data-slot="survey-compare-pairs"] .animate-pulse');

    $this->docShot($page, 'surveys/comparison', '[data-slot="survey-compare-pairs"]');
});
