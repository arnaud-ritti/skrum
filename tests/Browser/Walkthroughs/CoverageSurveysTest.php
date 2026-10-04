<?php

use App\Enums\TeamRole;
use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Enums\WorkspaceRole;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use App\Models\User;
use App\Models\Workspace;

/**
 * An open survey of the team Atlas, facilitated by Fran, with Bob as a plain member.
 *
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     survey: TeamSurvey,
 *     fran: User,
 *     bob: User,
 *     franRespondent: TeamSurveyRespondent
 * }
 */
function cvsSurvey(array $attributes = []): array
{
    $team = Team::factory()->create(['name' => 'Atlas']);
    $survey = TeamSurvey::factory()->for($team)->open()->withoutThreshold()->create(['title' => 'Sprint 42 pulse', ...$attributes]);

    [$fran, $franRespondent] = surveyFacilitator($survey);
    $fran->update(['name' => 'Fran Facilitator', 'locale' => 'en']);

    $bob = teamMember($team);
    $bob->update(['name' => 'Bob Member', 'locale' => 'en']);

    return ['survey' => $survey->fresh(), 'fran' => $fran, 'bob' => $bob, 'franRespondent' => $franRespondent];
}

function cvsWorkload(TeamSurvey $survey): TeamSurveyQuestion
{
    return surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['label' => 'How was your workload?', 'is_required' => true]);
}

function cvsUser(Team $team, string $name, TeamRole $role = TeamRole::Member): User
{
    $user = teamMember($team, $role);
    $user->update(['name' => $name, 'locale' => 'en']);

    return $user;
}

function cvsWorkspaceOutsider(Team $team): User
{
    $outsider = User::factory()->create(['name' => 'Oscar Outsider', 'locale' => 'en']);
    $team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    return $outsider;
}

function cvsForbidden(): string
{
    return '[data-slot="error-page"][data-status="403"]';
}

it('[CVS-01] refuses the builder to a plain member and to a guest with 403, and sends a visitor to the login', function () {
    ['survey' => $survey, 'bob' => $bob] = cvsSurvey(['guest_access_enabled' => true]);
    cvsWorkload($survey);
    $builderPath = route('surveys.edit', $survey, false);

    $this->signIn($bob, $builderPath)
        ->assertPresent(cvsForbidden())
        ->assertNotPresent('[data-slot="survey-builder"]');

    $guestPage = $this->joinAsGuest(route('surveys.join.show', $survey->guest_token, false), 'Gus Guest');

    $guestPage->assertPathIs(route('surveys.show', $survey, false))
        ->navigate($builderPath)
        ->assertPresent(cvsForbidden())
        ->assertNotPresent('[data-slot="survey-builder"]');

    $survey->update(['guest_access_enabled' => false]);

    visit($builderPath)->assertPathIs('/login');
});

it('[CVS-02] refuses a draft to a member who does not edit it, and sends its editor from the participant and results pages to the builder', function () {
    ['survey' => $survey, 'fran' => $fran, 'bob' => $bob] = cvsSurvey(['status' => TeamSurveyStatus::Draft, 'opened_at' => null]);
    cvsWorkload($survey);

    $bobPage = $this->signIn($bob, route('surveys.show', $survey, false));

    $bobPage->assertPresent(cvsForbidden())
        ->assertDontSee('How was your workload?')
        ->navigate(route('surveys.results.show', $survey, false))
        ->assertPresent(cvsForbidden());

    $this->signIn($fran, route('surveys.show', $survey, false))
        ->assertPathIs(route('surveys.edit', $survey, false))
        ->assertPresent('[data-slot="survey-builder"]')
        ->navigate(route('surveys.results.show', $survey, false))
        ->assertPathIs(route('surveys.edit', $survey, false));
});

it('[CVS-03] refuses the participant and results pages to a workspace member outside the team, and sends a visitor to the login or, when guests are allowed, to the session-ended page', function () {
    ['survey' => $survey] = cvsSurvey(['status' => TeamSurveyStatus::Closed, 'closed_at' => now()]);
    cvsWorkload($survey);
    $outsider = cvsWorkspaceOutsider($survey->team);

    $this->signIn($outsider, route('surveys.show', $survey, false))
        ->assertPresent(cvsForbidden())
        ->assertDontSee('Sprint 42 pulse')
        ->navigate(route('surveys.results.show', $survey, false))
        ->assertPresent(cvsForbidden())
        ->assertNotPresent('[data-slot="survey-results-grid"]');

    visit(route('surveys.results.show', $survey, false))->assertPathIs('/login');

    $survey->update(['guest_access_enabled' => true]);

    visit(route('surveys.show', $survey, false))
        ->assertSee('Your session has ended.')
        ->assertSee('Guests: ask the facilitator for the guest link.')
        ->assertDontSee('How was your workload?');
});

it('[CVS-04] shows an observer of the team the questions read only, with the observer line and nothing to send', function () {
    ['survey' => $survey] = cvsSurvey(['one_question_at_a_time' => false]);
    $workload = cvsWorkload($survey);
    $olga = cvsUser($survey->team, 'Olga Observer', TeamRole::Observer);

    $page = $this->awaitRealtime($this->signIn($olga, route('surveys.show', $survey, false)));

    $page->assertSee('You are observing this session.')
        ->assertSeeIn('[data-slot="survey-question"]', 'How was your workload?')
        ->assertDisabled('[data-slot="survey-question"] input[type="radio"][value="4"]')
        ->assertNotPresent('button:has-text("Finish")');

    expect($workload->answers()->count())->toBe(0);
});

it('[CVS-05] shows a guest the results of a closed survey without the team, the sidebar, Share or Compare', function () {
    ['survey' => $survey, 'franRespondent' => $franRespondent] = cvsSurvey(['guest_access_enabled' => true]);
    $workload = cvsWorkload($survey);
    answerSurveyQuestion($workload, $franRespondent, 4);

    $guestPage = $this->joinAsGuest(route('surveys.join.show', $survey->guest_token, false), 'Gus Guest');

    $survey->update(['status' => TeamSurveyStatus::Closed, 'closed_at' => now()]);

    $guestPage->navigate(route('surveys.results.show', $survey, false))
        ->assertPresent('[data-slot="survey-results-grid"]')
        ->assertSeeIn('[data-slot="survey-key-figure"]', '4.0')
        ->assertDontSee('Atlas')
        ->assertNotPresent('[data-slot="sidebar"]')
        ->assertNotPresent('button[aria-label="Share with the team"]')
        ->assertNotPresent('[role="tab"]:has-text("Compare")')
        ->assertNotPresent('a:has-text("Export CSV")');
});

it('[CVS-06] tells a visitor that a guest link is no longer valid when it is unknown, turned off or points to a draft, and sends a member who has the survey to it', function () {
    ['survey' => $survey, 'bob' => $bob] = cvsSurvey(['guest_access_enabled' => true]);
    cvsWorkload($survey);
    $joinPath = route('surveys.join.show', $survey->guest_token, false);

    visit('/surveys/join/not-a-guest-token-of-any-survey')
        ->assertSee('This guest link is no longer valid.')
        ->assertNotPresent('#name');

    $survey->update(['guest_access_enabled' => false]);

    visit($joinPath)->assertSee('This guest link is no longer valid.');

    $survey->update(['guest_access_enabled' => true, 'status' => TeamSurveyStatus::Draft, 'opened_at' => null]);

    visit($joinPath)->assertSee('This guest link is no longer valid.');

    $survey->update(['status' => TeamSurveyStatus::Open, 'opened_at' => now()]);

    $this->signIn($bob, $joinPath)
        ->assertPathIs(route('surveys.show', $survey, false))
        ->assertSee('How was your workload?');
});

it('[CVS-07] signs the guests out when the facilitator replaces the guest link from Share: the old link is dead, the new one lets a guest in', function () {
    ['survey' => $survey, 'fran' => $fran] = cvsSurvey(['guest_access_enabled' => true]);
    cvsWorkload($survey);
    $oldJoinPath = route('surveys.join.show', $survey->guest_token, false);

    $guestPage = $this->joinAsGuest($oldJoinPath, 'Gus Guest');
    $guestPage->assertSee('How was your workload?');

    $franPage = $this->signIn($fran, route('surveys.results.show', $survey, false));

    $franPage->click('button[aria-label="Share with the team"]')
        ->assertPresent('[data-slot="share-dialog"]')
        ->click('[data-slot="share-dialog"] button:has-text("Create a new link")')
        ->click('[role="alertdialog"] button:has-text("Create a new link")');

    $newJoinPath = (string) parse_url(route('surveys.join.show', $survey->fresh()->guest_token), PHP_URL_PATH);

    expect($newJoinPath)->not->toBe($oldJoinPath)
        ->and(TeamSurveyRespondent::query()->where('team_survey_id', $survey->id)->whereNull('user_id')->sole()->guest_secret_hash)->toBeNull();

    $guestPage->navigate(route('surveys.show', $survey, false))
        ->assertSee('Your session has ended.')
        ->assertDontSee('How was your workload?');

    visit($oldJoinPath)->assertSee('This guest link is no longer valid.');

    $this->joinAsGuest($newJoinPath, 'Gia Guest')
        ->assertPathIs(route('surveys.show', $survey, false))
        ->assertSee('How was your workload?');
});

it('[CVS-08] sends whoever opens the participant or results page of a health check attached to a retro to that retro', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $retro = Retro::factory()->for($team)->create(['title' => 'Sprint 42 retro']);
    $healthCheck = TeamSurvey::factory()->attachedTo($retro)->open()->create();
    $bob = cvsUser($team, 'Bob Member');

    $page = $this->signIn($bob, route('surveys.show', $healthCheck, false));

    $page->assertPathIs(route('retros.show', $retro, false))
        ->navigate(route('surveys.results.show', $healthCheck, false))
        ->assertPathIs(route('retros.show', $retro, false));
});

it('[CVS-09] refuses the health check page to a workspace member outside the team and to someone of another workspace, sends a visitor to the login, and offers an observer no "Start a health check"', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $healthCheckPath = route('teams.healthCheck.show', [$team->workspace, $team], false);
    $outsider = cvsWorkspaceOutsider($team);
    $stranger = User::factory()->create(['name' => 'Sam Stranger', 'locale' => 'en']);
    $strangerWorkspace = Workspace::factory()->withMember($stranger, WorkspaceRole::Owner)->create();
    $olga = cvsUser($team, 'Olga Observer', TeamRole::Observer);

    $this->signIn($outsider, $healthCheckPath)
        ->assertPresent(cvsForbidden())
        ->assertNotPresent('[data-slot="team-health-check"]');

    $this->signIn($stranger, route('teams.healthCheck.show', [$strangerWorkspace, $team], false))
        ->assertPresent('[data-slot="error-page"][data-status="404"]')
        ->assertNotPresent('[data-slot="team-health-check"]');

    visit($healthCheckPath)->assertPathIs('/login');

    $this->signIn($olga, $healthCheckPath)
        ->assertPresent('[data-slot="team-health-check"]')
        ->assertNotPresent('a:has-text("Start a health check")');
});

it('[CVS-10] lists a draft on the team page to its editor only, and an open survey to every member', function () {
    ['survey' => $draft, 'fran' => $fran, 'bob' => $bob] = cvsSurvey(['title' => 'Draft pulse', 'status' => TeamSurveyStatus::Draft, 'opened_at' => null]);
    TeamSurvey::factory()->for($draft->team)->open()->create(['title' => 'Open pulse']);
    $teamPath = route('teams.show', [$draft->team->workspace, $draft->team], false);

    $this->signIn($fran, $teamPath)
        ->assertPresent('[data-slot="team-surveys"] [data-test="survey-card"]:has-text("Draft pulse")')
        ->assertPresent('[data-slot="team-surveys"] [data-test="survey-card"]:has-text("Open pulse")');

    $this->signIn($bob, $teamPath)
        ->assertPresent('[data-slot="team-surveys"] [data-test="survey-card"]:has-text("Open pulse")')
        ->assertNotPresent('[data-slot="team-surveys"] [data-test="survey-card"]:has-text("Draft pulse")');
});

it('[CVS-11] duplicates a survey from its card on the team page into a draft with the same questions, then opens its builder', function () {
    ['survey' => $survey, 'fran' => $fran, 'franRespondent' => $franRespondent] = cvsSurvey(['status' => TeamSurveyStatus::Closed, 'closed_at' => now()]);
    answerSurveyQuestion(cvsWorkload($survey), $franRespondent, 4);
    surveyQuestion($survey, TeamSurveyQuestionKind::Single, ['label' => 'Which ritual should we keep?'], ['Daily', 'Demo']);

    $page = $this->signIn($fran, route('teams.show', [$survey->team->workspace, $survey->team], false));

    $page->click('[data-test="survey-card"] [aria-label="Survey actions"]')
        ->click('[role="menuitem"]:has-text("Duplicate")')
        ->assertPathEndsWith('/edit');

    $copy = TeamSurvey::query()->whereKeyNot($survey->id)->sole();

    $page->assertPathIs(route('surveys.edit', $copy, false))
        ->assertCount('[data-slot="survey-builder"] [data-test="survey-question"]', 2)
        ->assertSee('Draft');

    expect($copy->status)->toBe(TeamSurveyStatus::Draft)
        ->and($copy->previous_survey_id)->toBe($survey->id)
        ->and($copy->questions()->pluck('label')->all())->toBe(['How was your workload?', 'Which ritual should we keep?'])
        ->and(TeamSurveyRespondent::query()->where('team_survey_id', $copy->id)->whereHas('answers')->count())->toBe(0);
});

it('[CVS-12] adds a question of each of the five kinds from the "Add" bar of the builder', function () {
    ['survey' => $survey, 'fran' => $fran] = cvsSurvey(['status' => TeamSurveyStatus::Draft, 'opened_at' => null]);

    $page = $this->signIn($fran, route('surveys.edit', $survey, false));

    foreach (['Scale 1 – 5', 'NPS', 'Single choice', 'Multiple choice', 'Free text'] as $index => $kind) {
        $page->click("[data-slot=\"survey-add-bar\"] button:has-text(\"{$kind}\")")
            ->assertCount('[data-slot="survey-builder"] [data-test="survey-question"]', $index + 1);
    }

    $page->assertSee('5 questions');

    expect($survey->questions()->pluck('kind')->all())->toBe([
        TeamSurveyQuestionKind::Scale,
        TeamSurveyQuestionKind::Nps,
        TeamSurveyQuestionKind::Single,
        TeamSurveyQuestionKind::Multiple,
        TeamSurveyQuestionKind::Text,
    ]);
});

it('[CVS-13] no longer offers "Back to draft" once someone has answered', function () {
    ['survey' => $survey, 'fran' => $fran, 'bob' => $bob] = cvsSurvey();
    $workload = cvsWorkload($survey);
    $bobRespondent = TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id, 'user_id' => $bob->id]);
    answerSurveyQuestion($workload, $bobRespondent, 3);

    $this->signIn($fran, route('surveys.edit', $survey, false))
        ->assertPresent('[data-slot="survey-builder"]')
        ->assertNotPresent('[data-slot="survey-builder-topbar"] button[aria-label="Back to draft"]')
        ->assertSee('Questions cannot change once a survey is open.');
});

it('[CVS-14] says there is nothing to compare with when the team has no other closed survey', function () {
    ['survey' => $survey, 'fran' => $fran, 'franRespondent' => $franRespondent] = cvsSurvey(['status' => TeamSurveyStatus::Closed, 'closed_at' => now()]);
    answerSurveyQuestion(cvsWorkload($survey), $franRespondent, 4);

    $this->signIn($fran, route('surveys.results.show', $survey, false))
        ->assertNotPresent('[data-slot="survey-results-grid"] [data-slot="survey-delta"]')
        ->click('[role="tab"]:has-text("Compare")')
        ->assertSee('Nothing to compare with yet.')
        ->assertNotPresent('[data-slot="survey-compare-pair"]');
});

it('[CVS-15] reads the mean 3.8, the most frequent answer 4, the NPS 22 with 2, 3 and 4 people, and "6 · 67%" on the results of nine respondents', function () {
    ['survey' => $survey, 'fran' => $fran, 'franRespondent' => $franRespondent] = cvsSurvey(['status' => TeamSurveyStatus::Closed, 'closed_at' => now()]);
    $workload = cvsWorkload($survey);
    $nps = surveyQuestion($survey, TeamSurveyQuestionKind::Nps, ['label' => 'Would you recommend the team?']);
    $slowed = surveyQuestion($survey, TeamSurveyQuestionKind::Multiple, ['label' => 'What slowed you down?'], ['Meetings', 'Reviews']);
    $respondents = [$franRespondent];

    for ($member = 1; $member <= 8; $member++) {
        $respondents[] = surveyMember($survey)[1];
    }

    foreach ([2, 3, 3, 4, 4, 4, 5, 5, 4] as $index => $value) {
        answerSurveyQuestion($workload, $respondents[$index], $value);
    }

    foreach ([5, 6, 7, 8, 8, 9, 9, 10, 10] as $index => $value) {
        answerSurveyQuestion($nps, $respondents[$index], $value);
    }

    foreach ([[0], [0], [0], [0], [0], [0, 1], [1], [1], [1]] as $index => $options) {
        answerSurveyQuestion($slowed, $respondents[$index], $options);
    }

    $page = $this->signIn($fran, route('surveys.results.show', $survey, false));

    $page->assertSeeIn('[data-slot="survey-question"]:has-text("How was your workload?") [data-slot="survey-key-figure"]', '3.8')
        ->assertSeeIn('[data-slot="survey-question"]:has-text("How was your workload?") [data-slot="survey-key-figure-mode"]', '4')
        ->assertSeeIn('[data-slot="survey-question"]:has-text("Would you recommend the team?") [data-slot="survey-key-figure"]', '+22')
        ->assertAttribute('[data-slot="survey-nps-segments"]', 'aria-label', '2 detractors, 3 passives, 4 promoters')
        ->assertSeeIn('[data-slot="survey-question"]:has-text("What slowed you down?")', '6 · 67%');
});

it('[CVS-16] links the Mood trend point of a health check run as a survey to its results', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $survey = TeamSurvey::factory()->for($team)->healthCheck()->closed()->withoutThreshold()->create(['title' => 'Health check · October', 'template' => TeamSurveyTemplate::HealthCheck]);
    [$fran, $franRespondent] = surveyFacilitator($survey);
    $fran->update(['locale' => 'en']);
    answerSurveyQuestion(surveyQuestion($survey, TeamSurveyQuestionKind::Scale, ['match_key' => 'motivation']), $franRespondent, 4);

    $page = $this->signIn($fran, route('teams.healthCheck.show', [$team->workspace, $team], false));

    $page->assertPresent('[data-slot="mood-trend-link"][aria-label*="Health check · October"]')
        ->click('[data-slot="mood-trend-link"][aria-label*="Health check · October"]')
        ->assertPathIs(route('surveys.results.show', $survey, false))
        ->assertPresent('[data-slot="survey-results-grid"]');
});
