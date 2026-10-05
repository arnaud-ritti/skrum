<?php

use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use App\Models\User;

/**
 * An open survey of the team Atlas, facilitated by Fran, with Bob as a plain member.
 *
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: TeamSurvey,
 *     1: User,
 *     2: User,
 *     3: TeamSurveyRespondent
 * }
 */
function teamSurveysSurvey(array $attributes = []): array
{
    $team = Team::factory()->create(['name' => 'Atlas']);
    $survey = TeamSurvey::factory()->for($team)->open()->withoutThreshold()->create(['title' => 'Sprint 42 pulse', ...$attributes]);

    [$fran, $franRespondent] = surveyFacilitator($survey);
    $fran->update(['name' => 'Fran Facilitator', 'locale' => 'en']);

    $bob = teamMember($team);
    $bob->update(['name' => 'Bob Member', 'locale' => 'en']);

    return [$survey->fresh(), $fran, $bob, $franRespondent];
}

function teamSurveysRitual(TeamSurvey $survey, bool $required = false): TeamSurveyQuestion
{
    return surveyQuestion($survey, TeamSurveyQuestionKind::Single, ['label' => 'Which ritual should we keep?', 'is_required' => $required], ['Daily', 'Demo', 'Pairing']);
}

function teamSurveysFinished(TeamSurveyRespondent $respondent): TeamSurveyRespondent
{
    $respondent->update(['completed_at' => now()]);

    return $respondent;
}

function teamSurveysStep(): string
{
    return '[data-test="survey-step"]';
}

function teamSurveysPick(int $value): string
{
    return teamSurveysStep()." label:has(input[value=\"{$value}\"])";
}

function teamSurveysChoice(string $label): string
{
    return teamSurveysStep()." label:has-text(\"{$label}\")";
}

function teamSurveysQuestion(int $number): string
{
    return "[data-slot=\"survey-builder\"] section[aria-label=\"Question {$number}\"]";
}

function teamSurveysAdd(string $kind): string
{
    return "[data-slot=\"survey-add-bar\"] button:has-text(\"{$kind}\")";
}

function teamSurveysSaved(): string
{
    return '[data-slot="survey-builder-topbar"] [data-save-state="saved"]:has([role="status"])';
}

function teamSurveysSessionRoot(): string
{
    return '[data-slot="session-root"]';
}

it('creates a Team pulse from the "New session" dialog, opens its builder with the five questions and lists it as a draft on the team page', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $fran = teamMember($team);
    $fran->update(['name' => 'Fran Facilitator', 'locale' => 'en']);
    $teamPath = route('teams.show', [$team->workspace, $team], false);

    $page = $this->signIn($fran, $teamPath);

    $page->assertSee('No survey published')
        ->click('New session')
        ->click('[role="dialog"] [role="radio"]:has-text("Poll")')
        ->assertPresent('[role="dialog"] #new-survey-title')
        ->assertAriaAttribute('[data-slot="survey-start-choice"][data-choice="blank"]', 'checked', 'true')
        ->click('[data-slot="survey-start-choice"][data-choice="team_pulse"]')
        ->assertAriaAttribute('[data-slot="survey-start-choice"][data-choice="team_pulse"]', 'checked', 'true')
        ->fill('#new-survey-title', 'Sprint 42 pulse')
        ->click('[role="dialog"] button:has-text("Create & open")')
        ->assertPathEndsWith('/edit');

    $survey = TeamSurvey::query()->where('title', 'Sprint 42 pulse')->sole();

    $page->assertPathIs(route('surveys.edit', $survey, false))
        ->assertPresent('[data-slot="survey-builder"]')
        ->assertValue('#survey-title', 'Sprint 42 pulse')
        ->assertCount('[data-slot="survey-builder"] [data-test="survey-question"]', 5)
        ->assertSee('5 questions')
        ->assertSee('Draft')
        ->assertEnabled('[data-slot="survey-builder-topbar"] button[aria-label="Publish"]');

    expect($survey->status)->toBe(TeamSurveyStatus::Draft)
        ->and($survey->template)->toBe(TeamSurveyTemplate::TeamPulse)
        ->and($survey->facilitator->user_id)->toBe($fran->id);

    $page->navigate($teamPath)
        ->assertPresent('[data-slot="team-surveys"] [data-test="survey-card"]:has-text("Sprint 42 pulse")')
        ->assertSeeIn('[data-slot="team-surveys"] [data-test="survey-card"]', 'Draft')
        ->assertSeeIn('[data-slot="team-surveys"] [data-slot="survey-counts"]', '5 questions');
});

it('builds a blank survey: adds, relabels, requires, duplicates and deletes questions, each change saved without a save button', function () {
    [$survey, $fran] = teamSurveysSurvey(['status' => TeamSurveyStatus::Draft, 'opened_at' => null]);

    $page = $this->signIn($fran, route('surveys.edit', $survey, false));

    $page->assertSee('No question yet')
        ->assertDisabled('[data-slot="survey-builder-topbar"] button[aria-label="Publish"]')
        ->click(teamSurveysAdd('Scale 1 – 5'))
        ->assertPresent(teamSurveysQuestion(1).'[data-open="true"]')
        ->fill(teamSurveysQuestion(1).' input[aria-label="Label"]', 'How was your workload?')
        ->click(teamSurveysQuestion(1).' button[role="switch"]')
        ->assertPresent(teamSurveysSaved())
        ->click(teamSurveysAdd('Single choice'))
        ->assertPresent(teamSurveysQuestion(2).'[data-open="true"]')
        ->assertPresent(teamSurveysQuestion(2).' [data-slot="survey-options-editor"]')
        ->fill(teamSurveysQuestion(2).' input[aria-label="Label"]', 'Which ritual should we keep?')
        ->assertPresent(teamSurveysSaved())
        ->click(teamSurveysQuestion(2).' button[aria-label="Duplicate"]')
        ->assertCount('[data-slot="survey-builder"] [data-test="survey-question"]', 3)
        ->assertSee('3 questions')
        ->assertPresent(teamSurveysQuestion(3).'[data-open="true"]')
        ->click(teamSurveysQuestion(3).' button[aria-label="Delete"]')
        ->assertSee('Delete this question?')
        ->click('[role="alertdialog"] button:has-text("Delete")')
        ->assertCount('[data-slot="survey-builder"] [data-test="survey-question"]', 2)
        ->assertSee('2 questions')
        ->assertSeeIn(teamSurveysQuestion(1), 'Required')
        ->assertEnabled('[data-slot="survey-builder-topbar"] button[aria-label="Publish"]');

    $questions = $survey->questions()->with('options')->get();

    expect($questions->pluck('label')->all())->toBe(['How was your workload?', 'Which ritual should we keep?'])
        ->and($questions->pluck('kind')->all())->toBe([TeamSurveyQuestionKind::Scale, TeamSurveyQuestionKind::Single])
        ->and($questions[0]->is_required)->toBeTrue()
        ->and($questions[1]->is_required)->toBeFalse()
        ->and($questions[1]->options->pluck('label')->all())->toBe(['Option 1', 'Option 2']);
});

it('publishes a draft, locks its questions once open, and takes it back to draft while nobody has answered', function () {
    [$survey, $fran] = teamSurveysSurvey(['status' => TeamSurveyStatus::Draft, 'opened_at' => null]);
    workloadQuestion($survey);

    $page = $this->signIn($fran, route('surveys.edit', $survey, false));

    $page->assertPresent('[data-slot="survey-add-bar"]')
        ->click('[data-slot="survey-builder-topbar"] button[aria-label="Publish"]')
        ->assertSee('Questions cannot change once a survey is open.')
        ->assertNotPresent('[data-slot="survey-add-bar"]')
        ->assertNotPresent(teamSurveysQuestion(1).' input[aria-label="Label"]')
        ->assertPresent('[data-slot="survey-builder-topbar"] a[aria-label="View results"]');

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Open);

    $page->click('[data-slot="survey-builder-topbar"] button[aria-label="Back to draft"]')
        ->assertPresent('[data-slot="survey-add-bar"]')
        ->assertDontSee('Questions cannot change once a survey is open.');

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Draft);
});

it('keeps a member on a required question left empty, then saves each answer, finishes and lets the member change them', function () {
    [$survey, , $bob] = teamSurveysSurvey();
    $workload = workloadQuestion($survey);
    $ritual = teamSurveysRitual($survey);

    $page = $this->awaitRealtime($this->signIn($bob, route('surveys.show', $survey, false)));

    $page->assertSee('Question 1 of 2')
        ->assertSeeIn(teamSurveysStep(), 'How was your workload?')
        ->click('Next')
        ->assertSee('Question 1 of 2')
        ->assertSeeIn(teamSurveysStep(), 'An answer is required.')
        ->click(teamSurveysPick(4))
        ->assertDontSee('An answer is required.')
        ->click('Next')
        ->assertSee('Question 2 of 2')
        ->click(teamSurveysChoice('Demo'))
        ->click('Finish')
        ->assertSee('Thank you — your answers are saved.')
        ->assertSee('1 of 2 have answered')
        ->assertPresent('button:has-text("Change my answers")');

    $respondent = TeamSurveyRespondent::query()->where('team_survey_id', $survey->id)->where('user_id', $bob->id)->sole();

    expect($respondent->completed_at)->not->toBeNull()
        ->and($workload->answers()->sole()->value)->toBe(4)
        ->and($ritual->answers()->sole()->options()->sole()->label)->toBe('Demo');

    $page->click('Change my answers')
        ->assertSee('Question 1 of 2')
        ->assertChecked(teamSurveysPick(4).' input');

    expect($respondent->fresh()->completed_at)->toBeNull();
});

it('moves the counter and the results of the facilitator live when a member finishes, and closes the member\'s page when the facilitator closes the survey', function () {
    [$survey, $fran, $bob, $franRespondent] = teamSurveysSurvey();
    $workload = workloadQuestion($survey);
    answerSurveyQuestion($workload, $franRespondent, 4);
    teamSurveysFinished($franRespondent);

    $franPage = $this->awaitRealtime($this->signIn($fran, route('surveys.show', $survey, false)));
    $bobPage = $this->awaitRealtime($this->signIn($bob, route('surveys.show', $survey, false)));

    $franPage->assertSee('1 of 2 have answered')
        ->assertSeeIn('[data-slot="survey-question"]', '1 response');

    $bobPage->click(teamSurveysPick(2))
        ->click('Finish')
        ->assertSee('Thank you — your answers are saved.');

    $franPage->assertSee('2 of 2 have answered')
        ->assertSeeIn('[data-slot="survey-question"]', '2 responses');

    $franPage->navigate(route('surveys.results.show', $survey, false))
        ->assertSeeIn('[data-slot="survey-results-line"]', '2 answers out of 2 participants · anonymous')
        ->click('[data-slot="survey-results-header"] button:has-text("Close the survey")')
        ->assertSee('Close the survey?')
        ->click('[role="alertdialog"] button:has-text("Close the survey")')
        ->assertPresent('[data-slot="survey-results-header"] button[aria-label="More actions"]')
        ->assertPresent('[data-slot="survey-results-header"] a:has-text("Export CSV")');

    $bobPage->assertSeeIn(teamSurveysSessionRoot(), 'This survey is closed.')
        ->assertPresent(teamSurveysSessionRoot().' a:has-text("See the results")');

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Closed);
});

it('lets a guest join with the link, answer and see the results after finishing, without the team\'s name', function () {
    [$survey] = teamSurveysSurvey(['guest_access_enabled' => true]);
    workloadQuestion($survey);

    $guestPage = $this->awaitRealtime($this->joinAsGuest(route('surveys.join.show', $survey->guest_token, false), 'Gus Guest'));

    $guestPage->assertPathIs(route('surveys.show', $survey, false))
        ->assertSee('Sprint 42 pulse')
        ->assertDontSee('Atlas')
        ->assertSee('Anonymous answers')
        ->click(teamSurveysPick(5))
        ->click('Finish')
        ->assertSee('Thank you — your answers are saved.')
        ->assertSeeIn('[data-slot="survey-question"]', '1 response');

    $guest = TeamSurveyRespondent::query()->where('team_survey_id', $survey->id)->whereNull('user_id')->sole();

    expect($guest->guest_name)->toBe('Gus Guest')
        ->and($guest->completed_at)->not->toBeNull();
});

it('tells a member who has answered how many answers are still missing below the threshold, and tells a member who has not answered that results show once the survey is closed', function () {
    [$survey, , $bob] = teamSurveysSurvey(['results_threshold' => 3]);
    $workload = workloadQuestion($survey);
    $bobRespondent = TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id, 'user_id' => $bob->id]);
    answerSurveyQuestion($workload, $bobRespondent, 4);
    teamSurveysFinished($bobRespondent);
    $cleo = teamMember($survey->team);
    $cleo->update(['name' => 'Cleo Member', 'locale' => 'en']);

    $page = $this->signIn($bob, route('surveys.results.show', $survey, false));

    $page->assertSeeIn('[data-slot="survey-results-state"]', 'Results appear from 3 answers. 1 so far.')
        ->assertNotPresent('[data-slot="survey-results-grid"]');

    $survey->update(['results_threshold' => 0, 'show_results_after_answer' => false]);

    $this->signIn($cleo, route('surveys.results.show', $survey, false))
        ->assertSeeIn('[data-slot="survey-results-state"]', 'Results will show when the survey is closed.')
        ->assertNotPresent('[data-slot="survey-results-grid"]');
});

it('compares a closed survey with the one it was duplicated from, question by question', function () {
    [$previous] = teamSurveysSurvey(['title' => 'Sprint 41 pulse', 'status' => TeamSurveyStatus::Closed, 'closed_at' => now()->subWeek()]);
    $before = workloadQuestion($previous);
    answerSurveyQuestion($before, TeamSurveyRespondent::query()->where('team_survey_id', $previous->id)->sole(), 2);

    $current = TeamSurvey::factory()->for($previous->team)->closed()->withoutThreshold()->create([
        'title' => 'Sprint 42 pulse',
        'previous_survey_id' => $previous->id,
    ]);
    [$facilitator, $facilitatorRespondent] = surveyFacilitator($current);
    $now = surveyQuestion($current, TeamSurveyQuestionKind::Scale, ['label' => 'How was your workload?', 'match_key' => $before->match_key]);
    answerSurveyQuestion($now, $facilitatorRespondent, 4);

    $page = $this->signIn($facilitator, route('surveys.results.show', $current, false));

    $page->assertPresent('[data-slot="survey-results-grid"] [data-slot="survey-delta"]')
        ->click('[role="tab"]:has-text("Compare")')
        ->assertPresent('[data-slot="survey-compare-pairs"] [data-slot="survey-compare-pair"]')
        ->assertSeeIn('[data-slot="survey-compare-pair"] h3', 'How was your workload?')
        ->assertSeeIn('[data-slot="survey-compare-pair"] dl', 'Now')
        ->assertSeeIn('[data-slot="survey-compare-pair"] dl', '4.0 / 5')
        ->assertSeeIn('[data-slot="survey-compare-pair"] dl', 'Before')
        ->assertSeeIn('[data-slot="survey-compare-pair"] dl', '2.0 / 5')
        ->assertSee('Sprint 41 pulse');
});

it('offers the CSV export of a closed survey to its facilitator only, and serves the file', function () {
    [$survey, $fran, $bob, $franRespondent] = teamSurveysSurvey(['status' => TeamSurveyStatus::Closed, 'closed_at' => now()]);
    answerSurveyQuestion(workloadQuestion($survey), $franRespondent, 4);

    $franPage = $this->signIn($fran, route('surveys.results.show', $survey, false));

    $franPage->assertPresent('[data-slot="survey-results-header"] a:has-text("Export CSV")')
        ->assertAttribute('[data-slot="survey-results-header"] a:has-text("Export CSV")', 'href', route('surveys.export.show', $survey, false));

    $export = json_decode((string) $franPage->script("() => fetch('".route('surveys.export.show', $survey, false)."').then((response) => response.text().then((body) => JSON.stringify({ status: response.status, type: response.headers.get('content-type'), body })))"), true);

    expect($export['status'])->toBe(200)
        ->and($export['type'])->toContain('text/csv')
        ->and($export['body'])->toContain('Respondent 1');

    $this->signIn($bob, route('surveys.results.show', $survey, false))
        ->assertPresent('[data-slot="survey-results-grid"]')
        ->assertNotPresent('[data-slot="survey-results-header"] a:has-text("Export CSV")')
        ->assertNotPresent('[data-slot="survey-results-header"] button[aria-label="More actions"]');
});

it('shows an open participant page that the survey was deleted when its facilitator deletes it from the team page', function () {
    [$survey, $fran, $bob] = teamSurveysSurvey();
    workloadQuestion($survey);

    $bobPage = $this->awaitRealtime($this->signIn($bob, route('surveys.show', $survey, false)));
    $franPage = $this->signIn($fran, route('teams.show', [$survey->team->workspace, $survey->team], false));

    $franPage->click('[data-test="survey-card"] [aria-label="Survey actions"]')
        ->click('[role="menuitem"]:has-text("Delete")')
        ->assertSee('Delete this survey?')
        ->click('[role="alertdialog"] button:has-text("Delete")')
        ->assertNotPresent('[data-test="survey-card"]')
        ->assertSee('No survey published');

    $bobPage->assertSee('This survey was deleted.')
        ->assertPresent('a:has-text("Back to the team")');

    expect(TeamSurvey::query()->find($survey->id))->toBeNull();
});

it('starts a health check from the health check page, whose builder lists the team\'s statements read only', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $fran = teamMember($team);
    $fran->update(['name' => 'Fran Facilitator', 'locale' => 'en']);

    $page = $this->signIn($fran, route('teams.healthCheck.show', [$team->workspace, $team], false));

    $page->click('a:has-text("Start a health check")')
        ->assertPresent('[role="dialog"] #new-survey-title')
        ->assertAriaAttribute('[data-slot="survey-start-choice"][data-choice="health_check"]', 'checked', 'true')
        ->assertSeeIn('[data-slot="survey-start-choice"][data-choice="health_check"]', '6 statements · scored 1 to 5')
        ->fill('#new-survey-title', 'Health check · October')
        ->click('[role="dialog"] button:has-text("Create & open")')
        ->assertPathEndsWith('/edit');

    $survey = TeamSurvey::query()->where('title', 'Health check · October')->sole();

    $page->assertSee("The questions of a health check come from the team's statements.")
        ->assertPresent('a:has-text("Manage statements")')
        ->assertCount('[data-slot="survey-builder"] [data-test="survey-question"]', 6)
        ->assertNotPresent('[data-slot="survey-add-bar"]')
        ->assertNotPresent('[data-slot="survey-builder"] input[aria-label="Label"]')
        ->assertSeeIn(teamSurveysQuestion(1), 'Strongly disagree')
        ->assertSeeIn(teamSurveysQuestion(1), 'Strongly agree');

    expect($survey->template)->toBe(TeamSurveyTemplate::HealthCheck)
        ->and($survey->questions()->where('is_required', true)->count())->toBe(6);
});

it('answers on a phone with the card full width, the buttons docked at the bottom and no horizontal overflow', function () {
    [$survey, , $bob] = teamSurveysSurvey();
    workloadQuestion($survey);
    surveyQuestion($survey, TeamSurveyQuestionKind::Nps, ['label' => 'Would you recommend the team?']);

    $page = $this->signIn($bob, route('surveys.show', $survey, false));
    $page->resize(390, 844);

    $page->assertAttribute(teamSurveysStep(), 'data-layout', 'phone')
        ->assertScript("(({ footer, card }) => Math.round(footer.bottom) === window.innerHeight && Math.round(footer.width) === window.innerWidth && Math.round(card.left) === 16 && Math.round(card.right) === window.innerWidth - 16)({ footer: document.querySelector('[data-slot=\"survey-flow-footer\"]').getBoundingClientRect(), card: document.querySelector('".teamSurveysStep()."').getBoundingClientRect() })", true)
        ->assertPresent('[data-slot="survey-flow-footer"] button[aria-label="Previous"]')
        ->assertPresent('[data-slot="survey-flow-footer"] button:has-text("Next")')
        ->click(teamSurveysPick(3))
        ->click('[data-slot="survey-flow-footer"] button:has-text("Next")')
        ->assertSeeIn(teamSurveysStep(), 'Would you recommend the team?')
        ->assertCount(teamSurveysStep().' [role="radiogroup"] input[type="radio"]', 11);

    expect($this->overflowingElements($page))->toBe([]);
});

it('shows the results in the dark theme without horizontal overflow', function () {
    [$survey, $fran, , $franRespondent] = teamSurveysSurvey(['status' => TeamSurveyStatus::Closed, 'closed_at' => now()]);
    answerSurveyQuestion(workloadQuestion($survey), $franRespondent, 4);
    answerSurveyQuestion(teamSurveysRitual($survey), $franRespondent, [1]);

    $page = $this->signIn($fran, route('surveys.results.show', $survey, false));
    $page->script("() => { localStorage.setItem('appearance', 'dark'); document.cookie = 'appearance=dark;path=/;max-age=31536000;SameSite=Lax'; return true; }");
    $page->navigate(route('surveys.results.show', $survey, false));

    $page->assertScript("document.documentElement.classList.contains('dark')", true)
        ->assertCount('[data-slot="survey-results-grid"] [data-slot="survey-question"]', 2)
        ->assertSeeIn('[data-slot="survey-results-grid"]', '1 · 100%');

    expect($this->overflowingElements($page))->toBe([]);
});

it('speaks the reader\'s language on the participant page: English, then French', function () {
    [$survey, , $bob] = teamSurveysSurvey();
    workloadQuestion($survey);

    $page = $this->signIn($bob, route('surveys.show', $survey, false));

    $page->assertScript('document.documentElement.lang', 'en')
        ->assertSee('Question 1 of 1')
        ->assertSee('Anonymous answers')
        ->assertSee('Neither the facilitator nor the team can link this answer to you.')
        ->assertPresent('button:has-text("Finish")');

    $bob->update(['locale' => 'fr']);

    $page->navigate(route('surveys.show', $survey, false))
        ->assertScript('document.documentElement.lang', 'fr')
        ->assertSee('Question 1 sur 1')
        ->assertDontSee('Anonymous answers');
});

it('previews the participant view from the builder, then closes it on Finish without saving an answer', function () {
    [$survey, $fran] = teamSurveysSurvey(['status' => TeamSurveyStatus::Draft, 'opened_at' => null]);
    $workload = workloadQuestion($survey);

    $page = $this->signIn($fran, route('surveys.edit', $survey, false));

    $page->click('[data-slot="survey-builder-topbar"] button[aria-label="Preview"]')
        ->assertPresent('[role="dialog"] [data-slot="survey-preview"] [data-test="survey-step"]')
        ->assertSeeIn('[role="dialog"]', 'How was your workload?')
        ->assertSeeIn('[role="dialog"]', 'Question 1 of 1')
        ->click('[role="dialog"] '.teamSurveysPick(3))
        ->assertChecked('[role="dialog"] '.teamSurveysPick(3).' input')
        ->click('[role="dialog"] button:has-text("Finish")')
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent('[data-slot="survey-builder"]');

    expect($workload->answers()->count())->toBe(0)
        ->and($survey->fresh()->status)->toBe(TeamSurveyStatus::Draft);
});

it('previews every question on one page when the survey does not ask one at a time', function () {
    [$survey, $fran] = teamSurveysSurvey(['status' => TeamSurveyStatus::Draft, 'opened_at' => null, 'one_question_at_a_time' => false]);
    $workload = workloadQuestion($survey);
    teamSurveysRitual($survey);
    $workloadPick = '[role="dialog"] [data-slot="survey-question"]:has-text("How was your workload?") label:has(input[value="3"])';

    $page = $this->signIn($fran, route('surveys.edit', $survey, false));

    $page->click('[data-slot="survey-builder-topbar"] button[aria-label="Preview"]')
        ->assertPresent('[role="dialog"] [data-slot="survey-preview"]')
        ->assertNotPresent('[role="dialog"] '.teamSurveysStep())
        ->assertSeeIn('[role="dialog"]', 'How was your workload?')
        ->assertSeeIn('[role="dialog"]', 'Which ritual should we keep?')
        ->click($workloadPick)
        ->assertChecked("{$workloadPick} input")
        ->click('[role="dialog"] button:has-text("Finish")')
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent('[data-slot="survey-builder"]');

    expect($workload->answers()->count())->toBe(0)
        ->and($survey->fresh()->status)->toBe(TeamSurveyStatus::Draft);
});

it('writes the figures of the results as the reader\'s language does, each with its label', function () {
    [$survey, $fran, , $franRespondent] = teamSurveysSurvey(['status' => TeamSurveyStatus::Closed, 'closed_at' => now()]);
    answerSurveyQuestion(workloadQuestion($survey), $franRespondent, 4);
    answerSurveyQuestion(teamSurveysRitual($survey), $franRespondent, [1]);

    $page = $this->signIn($fran, route('surveys.results.show', $survey, false));

    $page->assertSeeIn('[data-slot="survey-key-figure"]', '4.0')
        ->assertSeeIn('[data-slot="survey-key-figure"]', 'average / 5')
        ->assertSeeIn('[data-slot="survey-results-grid"]', '1 · 100%');

    $fran->update(['locale' => 'fr']);

    $page->navigate(route('surveys.results.show', $survey, false))
        ->assertSeeIn('[data-slot="survey-key-figure"]', '4,0')
        ->assertSeeIn('[data-slot="survey-key-figure"]', 'moyenne / 5')
        ->assertScript("document.querySelector('[data-slot=\"survey-results-grid\"]').innerText.includes('1 · 100\u{202F}%') || document.querySelector('[data-slot=\"survey-results-grid\"]').innerText.includes('1 · 100\u{00A0}%')", true);
});

it('moves a question two places down from the keyboard, the grip keeping the focus between the steps', function () {
    [$survey, $fran] = teamSurveysSurvey(['status' => TeamSurveyStatus::Draft, 'opened_at' => null]);
    $workload = workloadQuestion($survey);
    teamSurveysRitual($survey);
    surveyQuestion($survey, TeamSurveyQuestionKind::Text, ['label' => 'Anything else?']);

    $page = $this->signIn($fran, route('surveys.edit', $survey, false));

    $page->assertCount('[data-slot="survey-builder"] [data-test="survey-question"]', 3)
        ->keys('button[aria-label="Reorder question 1"]', ' ')
        ->withKeyDown('ArrowDown', fn ($page) => $page)
        ->assertScript('document.activeElement?.getAttribute("aria-label")', 'Reorder question 2')
        ->withKeyDown('ArrowDown', fn ($page) => $page)
        ->assertScript('document.activeElement?.getAttribute("aria-label")', 'Reorder question 3')
        ->assertAriaAttribute('button[aria-label="Reorder question 3"]', 'pressed', 'true')
        ->withKeyDown('Space', fn ($page) => $page)
        ->assertSeeIn('[data-slot="questions-announcement"]', 'dropped at position 3 of 3')
        ->assertPresent(teamSurveysSaved());

    expect($survey->questions()->pluck('label')->all())
        ->toBe(['Which ritual should we keep?', 'Anything else?', $workload->label]);
});
