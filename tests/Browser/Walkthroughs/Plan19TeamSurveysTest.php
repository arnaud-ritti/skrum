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
function p19wSurvey(array $attributes = []): array
{
    $team = Team::factory()->create(['name' => 'Atlas']);
    $survey = TeamSurvey::factory()->for($team)->open()->withoutThreshold()->create(['title' => 'Sprint 42 pulse', ...$attributes]);

    [$fran, $franRespondent] = surveyFacilitator($survey);
    $fran->update(['name' => 'Fran Facilitator', 'locale' => 'en']);

    $bob = teamMember($team);
    $bob->update(['name' => 'Bob Member', 'locale' => 'en']);

    return [$survey->fresh(), $fran, $bob, $franRespondent];
}

function p19wWorkload(TeamSurvey $survey): TeamSurveyQuestion
{
    return surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['label' => 'How was your workload?', 'is_required' => true]);
}

function p19wRitual(TeamSurvey $survey, bool $required = false): TeamSurveyQuestion
{
    return surveyQuestion($survey, TeamSurveyQuestionKind::Single, ['label' => 'Which ritual should we keep?', 'is_required' => $required], ['Daily', 'Demo', 'Pairing']);
}

function p19wFinished(TeamSurvey $survey, User $user): TeamSurveyRespondent
{
    $respondent = TeamSurveyRespondent::query()->firstOrCreate(['team_survey_id' => $survey->id, 'user_id' => $user->id]);
    $respondent->update(['completed_at' => now()]);

    return $respondent;
}

function p19wStep(): string
{
    return '[data-test="survey-step"]';
}

function p19wPick(int $value): string
{
    return p19wStep()." label:has(input[value=\"{$value}\"])";
}

function p19wChoice(string $label): string
{
    return p19wStep()." label:has-text(\"{$label}\")";
}

function p19wQuestion(int $number): string
{
    return "[data-slot=\"survey-builder\"] section[aria-label=\"Question {$number}\"]";
}

function p19wAdd(string $kind): string
{
    return "[data-slot=\"survey-add-bar\"] button:has-text(\"{$kind}\")";
}

function p19wSaved(): string
{
    return '[data-slot="survey-builder-topbar"] [role="status"][data-save-state="saved"]';
}

function p19wSessionRoot(): string
{
    return '[data-slot="session-root"]';
}

it('[P19w-01] creates a Team pulse from the "New session" dialog, opens its builder with the five questions and lists it as a draft on the team page', function () {
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

it('[P19w-02] builds a blank survey: adds, relabels, requires, duplicates and deletes questions, each change saved without a save button', function () {
    [$survey, $fran] = p19wSurvey(['status' => TeamSurveyStatus::Draft, 'opened_at' => null]);

    $page = $this->signIn($fran, route('surveys.edit', $survey, false));

    $page->assertSee('No question yet')
        ->assertDisabled('[data-slot="survey-builder-topbar"] button[aria-label="Publish"]')
        ->click(p19wAdd('Scale 1 – 5'))
        ->assertPresent(p19wQuestion(1).'[data-open="true"]')
        ->fill(p19wQuestion(1).' input[aria-label="Label"]', 'How was your workload?')
        ->click(p19wQuestion(1).' button[role="switch"]')
        ->assertPresent(p19wSaved())
        ->click(p19wAdd('Single choice'))
        ->assertPresent(p19wQuestion(2).'[data-open="true"]')
        ->assertPresent(p19wQuestion(2).' [data-slot="survey-options-editor"]')
        ->fill(p19wQuestion(2).' input[aria-label="Label"]', 'Which ritual should we keep?')
        ->assertPresent(p19wSaved())
        ->click(p19wQuestion(2).' button[aria-label="Duplicate"]')
        ->assertCount('[data-slot="survey-builder"] [data-test="survey-question"]', 3)
        ->assertSee('3 questions')
        ->assertPresent(p19wQuestion(3).'[data-open="true"]')
        ->click(p19wQuestion(3).' button[aria-label="Delete"]')
        ->assertSee('Delete this question?')
        ->click('[role="alertdialog"] button:has-text("Delete")')
        ->assertCount('[data-slot="survey-builder"] [data-test="survey-question"]', 2)
        ->assertSee('2 questions')
        ->assertSeeIn(p19wQuestion(1), 'Required')
        ->assertEnabled('[data-slot="survey-builder-topbar"] button[aria-label="Publish"]');

    $questions = $survey->questions()->with('options')->get();

    expect($questions->pluck('label')->all())->toBe(['How was your workload?', 'Which ritual should we keep?'])
        ->and($questions->pluck('kind')->all())->toBe([TeamSurveyQuestionKind::Scale, TeamSurveyQuestionKind::Single])
        ->and($questions[0]->is_required)->toBeTrue()
        ->and($questions[1]->is_required)->toBeFalse()
        ->and($questions[1]->options->pluck('label')->all())->toBe(['Option 1', 'Option 2']);
});

it('[P19w-03] publishes a draft, locks its questions once open, and takes it back to draft while nobody has answered', function () {
    [$survey, $fran] = p19wSurvey(['status' => TeamSurveyStatus::Draft, 'opened_at' => null]);
    p19wWorkload($survey);

    $page = $this->signIn($fran, route('surveys.edit', $survey, false));

    $page->assertPresent('[data-slot="survey-add-bar"]')
        ->click('[data-slot="survey-builder-topbar"] button[aria-label="Publish"]')
        ->assertSee('Questions cannot change once a survey is open.')
        ->assertNotPresent('[data-slot="survey-add-bar"]')
        ->assertNotPresent(p19wQuestion(1).' input[aria-label="Label"]')
        ->assertPresent('[data-slot="survey-builder-topbar"] a[aria-label="View results"]');

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Open);

    $page->click('[data-slot="survey-builder-topbar"] button[aria-label="Back to draft"]')
        ->assertPresent('[data-slot="survey-add-bar"]')
        ->assertDontSee('Questions cannot change once a survey is open.');

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Draft);
});

it('[P19w-04] keeps a member on a required question left empty, then saves each answer, finishes and lets the member change them', function () {
    [$survey, , $bob] = p19wSurvey();
    $workload = p19wWorkload($survey);
    $ritual = p19wRitual($survey);

    $page = $this->awaitRealtime($this->signIn($bob, route('surveys.show', $survey, false)));

    $page->assertSee('Question 1 of 2')
        ->assertSeeIn(p19wStep(), 'How was your workload?')
        ->click('Next')
        ->assertSee('Question 1 of 2')
        ->assertSeeIn(p19wStep(), 'An answer is required.')
        ->click(p19wPick(4))
        ->assertDontSee('An answer is required.')
        ->click('Next')
        ->assertSee('Question 2 of 2')
        ->click(p19wChoice('Demo'))
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
        ->assertChecked(p19wPick(4).' input');

    expect($respondent->fresh()->completed_at)->toBeNull();
});

it('[P19w-05] moves the counter and the results of the facilitator live when a member finishes, and closes the member\'s page when the facilitator closes the survey', function () {
    [$survey, $fran, $bob, $franRespondent] = p19wSurvey();
    $workload = p19wWorkload($survey);
    answerSurveyQuestion($workload, $franRespondent, 4);
    p19wFinished($survey, $fran);

    $franPage = $this->awaitRealtime($this->signIn($fran, route('surveys.show', $survey, false)));
    $bobPage = $this->awaitRealtime($this->signIn($bob, route('surveys.show', $survey, false)));

    $franPage->assertSee('1 of 2 have answered')
        ->assertSeeIn('[data-slot="survey-question"]', '1 response');

    $bobPage->click(p19wPick(2))
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

    $bobPage->assertSeeIn(p19wSessionRoot(), 'This survey is closed.')
        ->assertPresent(p19wSessionRoot().' a:has-text("See the results")');

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Closed);
});

it('[P19w-06] lets a guest join with the link, answer and see the results after finishing, without the team\'s name', function () {
    [$survey] = p19wSurvey(['guest_access_enabled' => true]);
    p19wWorkload($survey);

    $guestPage = $this->awaitRealtime($this->joinAsGuest(route('surveys.join.show', $survey->guest_token, false), 'Gus Guest'));

    $guestPage->assertPathIs(route('surveys.show', $survey, false))
        ->assertSee('Sprint 42 pulse')
        ->assertDontSee('Atlas')
        ->assertSee('Anonymous answers')
        ->click(p19wPick(5))
        ->click('Finish')
        ->assertSee('Thank you — your answers are saved.')
        ->assertSeeIn('[data-slot="survey-question"]', '1 response');

    $guest = TeamSurveyRespondent::query()->where('team_survey_id', $survey->id)->whereNull('user_id')->sole();

    expect($guest->guest_name)->toBe('Gus Guest')
        ->and($guest->completed_at)->not->toBeNull();
});

it('[P19w-07] tells a member who has answered how many answers are still missing below the threshold, and an unfinished member when results show', function () {
    [$survey, $fran, $bob, $franRespondent] = p19wSurvey(['results_threshold' => 3]);
    $workload = p19wWorkload($survey);
    answerSurveyQuestion($workload, $franRespondent, 4);
    p19wFinished($survey, $fran);

    $page = $this->signIn($fran, route('surveys.results.show', $survey, false));

    $page->assertSeeIn('[data-slot="survey-results-state"]', 'Results appear from 3 answers. 1 so far.')
        ->assertNotPresent('[data-slot="survey-results-grid"]');

    $survey->update(['results_threshold' => 0, 'show_results_after_answer' => false]);

    $this->signIn($bob, route('surveys.results.show', $survey, false))
        ->assertSeeIn('[data-slot="survey-results-state"]', 'Results will show when the survey is closed.')
        ->assertNotPresent('[data-slot="survey-results-grid"]');
});

it('[P19w-08] compares a closed survey with the one it was duplicated from, question by question', function () {
    [$previous, $fran] = p19wSurvey(['title' => 'Sprint 41 pulse', 'status' => TeamSurveyStatus::Closed, 'closed_at' => now()->subWeek()]);
    $before = p19wWorkload($previous);
    answerSurveyQuestion($before, TeamSurveyRespondent::query()->where('team_survey_id', $previous->id)->sole(), 2);

    $current = TeamSurvey::factory()->for($previous->team)->closed()->withoutThreshold()->create([
        'title' => 'Sprint 42 pulse',
        'previous_survey_id' => $previous->id,
    ]);
    $franNow = TeamSurveyRespondent::factory()->create(['team_survey_id' => $current->id, 'user_id' => $fran->id]);
    $current->update(['facilitator_respondent_id' => $franNow->id]);
    $now = surveyQuestion($current, TeamSurveyQuestionKind::Scale, ['label' => 'How was your workload?', 'match_key' => $before->match_key]);
    answerSurveyQuestion($now, $franNow, 4);

    $page = $this->signIn($fran, route('surveys.results.show', $current, false));

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

it('[P19w-09] offers the CSV export of a closed survey to its facilitator only, and serves the file', function () {
    [$survey, $fran, $bob, $franRespondent] = p19wSurvey(['status' => TeamSurveyStatus::Closed, 'closed_at' => now()]);
    answerSurveyQuestion(p19wWorkload($survey), $franRespondent, 4);

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

it('[P19w-10] shows an open participant page that the survey was deleted when its facilitator deletes it from the team page', function () {
    [$survey, $fran, $bob] = p19wSurvey();
    p19wWorkload($survey);

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

it('[P19w-11] starts a health check from the health check page, whose builder lists the team\'s statements read only', function () {
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
        ->assertSeeIn(p19wQuestion(1), 'Strongly disagree')
        ->assertSeeIn(p19wQuestion(1), 'Strongly agree');

    expect($survey->template)->toBe(TeamSurveyTemplate::HealthCheck)
        ->and($survey->questions()->where('is_required', true)->count())->toBe(6);
});

it('[P19w-12] answers on a phone with the card full width, the buttons docked at the bottom and no horizontal overflow', function () {
    [$survey, , $bob] = p19wSurvey();
    p19wWorkload($survey);
    surveyQuestion($survey, TeamSurveyQuestionKind::Nps, ['label' => 'Would you recommend the team?']);

    $page = $this->signIn($bob, route('surveys.show', $survey, false));
    $page->resize(390, 844);

    $page->assertAttribute(p19wStep(), 'data-layout', 'phone')
        ->assertPresent('[data-slot="survey-flow-footer"] button[aria-label="Previous"]')
        ->assertPresent('[data-slot="survey-flow-footer"] button:has-text("Next")')
        ->click(p19wPick(3))
        ->click('[data-slot="survey-flow-footer"] button:has-text("Next")')
        ->assertSeeIn(p19wStep(), 'Would you recommend the team?')
        ->assertCount(p19wStep().' [role="radiogroup"] input[type="radio"]', 11);

    expect($this->overflowingElements($page))->toBe([]);
});

it('[P19w-13] shows the results in the dark theme without horizontal overflow', function () {
    [$survey, $fran, , $franRespondent] = p19wSurvey(['status' => TeamSurveyStatus::Closed, 'closed_at' => now()]);
    answerSurveyQuestion(p19wWorkload($survey), $franRespondent, 4);
    answerSurveyQuestion(p19wRitual($survey), $franRespondent, [1]);

    $page = $this->signIn($fran, route('surveys.results.show', $survey, false));
    $page->script("() => { localStorage.setItem('appearance', 'dark'); document.cookie = 'appearance=dark;path=/;max-age=31536000;SameSite=Lax'; return true; }");
    $page->navigate(route('surveys.results.show', $survey, false));

    $page->assertScript("document.documentElement.classList.contains('dark')", true)
        ->assertCount('[data-slot="survey-results-grid"] [data-slot="survey-question"]', 2)
        ->assertSeeIn('[data-slot="survey-results-grid"]', '1 · 100%');

    expect($this->overflowingElements($page))->toBe([]);
});

it('[P19w-14] speaks the reader\'s language on the participant page: English, then French', function () {
    [$survey, , $bob] = p19wSurvey();
    p19wWorkload($survey);

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
