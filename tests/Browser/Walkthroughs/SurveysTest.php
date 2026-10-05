<?php

use App\Enums\RetroPhase;
use App\Enums\SurveyKind;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyReaction;
use App\Models\SurveyTextAnswer;
use App\Models\User;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User,
 *     3: Participant,
 *     4: Participant
 * }
 */
function surveysBoard(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withGuestAccess()
        ->create(['title' => 'Sprint 12', ...$attributes]);

    Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Start', 'position' => 0]);

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $alice, $bob, $aliceParticipant, $bobParticipant];
}

/**
 * @param  array<int, string>  $options
 * @param  array<string, mixed>  $attributes
 */
function surveysSurvey(Retro $retro, Participant $creator, string $question, SurveyKind $kind = SurveyKind::Single, array $options = ['Great', 'Fine', 'Rough'], array $attributes = []): Survey
{
    $factory = Survey::factory()->state(['kind' => $kind]);

    if ($kind !== SurveyKind::Text) {
        $factory = $factory->withOptions($options);
    }

    return $factory->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $creator->id,
        'question' => $question,
        'position' => $retro->surveys()->count(),
        ...$attributes,
    ]);
}

function surveysCard(string $question): string
{
    return "article[aria-label=\"{$question}\"]";
}

function surveysOption(string $question, string $label): string
{
    return surveysCard($question)." li:has-text(\"{$label}\")";
}

function surveysChoice(string $question, string $label): string
{
    return surveysCard($question)." label:has-text(\"{$label}\")";
}

function surveysRadio(string $question, string $label): string
{
    return surveysChoice($question, $label).' input[type="radio"]';
}

function surveysCheckbox(string $question, string $label): string
{
    return surveysChoice($question, $label).' button[role="checkbox"]';
}

function surveysAnswerField(string $question): string
{
    return surveysCard($question).' textarea';
}

function surveysShowsResults(string $question): string
{
    $card = surveysCard($question);

    return "document.querySelector('{$card}').innerText.includes('%')";
}

function surveysTextAnswers(string $question): string
{
    $answers = surveysCard($question).' ul[aria-label="Answers"] li';

    return "[...document.querySelectorAll('{$answers}')].map((answer) => answer.firstChild.textContent).join(' | ')";
}

/**
 * @param  array<string, mixed>  $snapshot
 * @return array<string, mixed>
 */
function surveysent(array $snapshot, string $question): array
{
    return collect($snapshot['surveys'])->firstOrFail('question', $question);
}

function surveysAwaitShowVoters(mixed $page, string $question): mixed
{
    $actions = surveysCard($question).' [aria-label="Survey actions"]';

    $page->click($actions)
        ->assertAriaAttribute('[role="menuitemcheckbox"]', 'checked', 'true')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]');

    return $page;
}

it('creates a single choice, a multiple choice and a free text survey that a guest sees without reloading', function () {
    [$retro, $alice] = surveysBoard();
    $single = surveysCard('How was the sprint?');
    $multiple = surveysCard('Which practices helped?');
    $text = surveysCard('What should we try next?');
    $save = '[role="dialog"] button[type="submit"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertNotPresent('section[aria-label="Surveys"]')
        ->assertNotPresent('[aria-label="Facilitator menu"]');

    openQuickPoll($alicePage)
        ->fill('#survey-question', 'How was the sprint?')
        ->fill('#survey-description', 'One answer each.')
        ->fill('[aria-label="Option 1"]', 'Great')
        ->fill('[aria-label="Option 2"]', 'Fine')
        ->click('Add option')
        ->assertVisible('[aria-label="Option 3"]')
        ->fill('[aria-label="Option 3"]', 'Rough')
        ->click($save)
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent($single);

    $carolPage->assertPresent($single)
        ->assertSeeIn($single, 'One answer each.')
        ->assertCount("{$single} input[type=\"radio\"]", 3)
        ->assertSeeIn($single, '0 responses')
        ->assertSeeIn($single, 'Answer to join the discussion');

    openQuickPoll($alicePage)
        ->click('#survey-kind')
        ->assertPresent('[role="listbox"]')
        ->click('[role="option"]:has-text("Multiple choice")')
        ->assertNotPresent('[role="listbox"]')
        ->fill('#survey-question', 'Which practices helped?')
        ->fill('[aria-label="Option 1"]', 'Pairing')
        ->fill('[aria-label="Option 2"]', 'Demos')
        ->click($save)
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent($multiple);

    $carolPage->assertPresent($multiple)
        ->assertSeeIn($multiple, 'Multiple choice')
        ->assertCount("{$multiple} button[role=\"checkbox\"]", 2)
        ->assertDisabled("{$multiple} button:has-text(\"Submit\")");

    openQuickPoll($alicePage)
        ->click('#survey-kind')
        ->assertPresent('[role="listbox"]')
        ->click('[role="option"]:has-text("Free text")')
        ->assertNotPresent('[role="listbox"]')
        ->assertNotPresent('[aria-label="Option 1"]')
        ->fill('#survey-question', 'What should we try next?')
        ->click($save)
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent($text);

    $carolPage->assertPresent($text)
        ->assertPresent(surveysAnswerField('What should we try next?'))
        ->assertNotPresent("{$text} ul[aria-label=\"Answers\"]")
        ->assertCount('section[aria-label="Surveys"] article', 3)
        ->assertNotPresent('[aria-label="Survey actions"]');

    $alicePage->assertCount('[aria-label="Survey actions"]', 3);

    $surveys = $retro->surveys()->get();

    expect($surveys->map(fn (Survey $survey): string => $survey->kind->value)->all())->toBe(['single', 'multiple', 'text'])
        ->and($surveys[0]->options->pluck('label')->all())->toBe(['Great', 'Fine', 'Rough'])
        ->and($surveys[0]->description)->toBe('One answer each.')
        ->and($surveys[1]->options->pluck('label')->all())->toBe(['Pairing', 'Demos'])
        ->and($surveys[2]->options)->toBeEmpty();
});

it('shows the results of a single choice survey only to those who answered', function () {
    [$retro, , $bob, $aliceParticipant] = surveysBoard();
    $survey = surveysSurvey($retro, $aliceParticipant, 'How was the sprint?');
    $card = surveysCard('How was the sprint?');
    $great = surveysOption('How was the sprint?', 'Great');
    $fine = surveysOption('How was the sprint?', 'Fine');
    $rough = surveysOption('How was the sprint?', 'Rough');
    $showsResults = surveysShowsResults('How was the sprint?');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertSeeIn($card, '0 responses')
            ->assertScript($showsResults, false);
    }

    $bobPage->click(surveysChoice('How was the sprint?', 'Great'))
        ->assertPresent(surveysRadio('How was the sprint?', 'Great').':checked')
        ->assertSeeIn($great, '1 · 100%')
        ->assertSeeIn($fine, '0 · 0%')
        ->assertSeeIn($card, '1 response')
        ->assertSeeIn($card, 'Withdraw my answer');

    $carolPage->assertSeeIn($card, '1 response')
        ->assertScript($showsResults, false)
        ->assertDontSeeIn($card, 'Withdraw my answer');

    $carolPage->click(surveysChoice('How was the sprint?', 'Rough'))
        ->assertPresent(surveysRadio('How was the sprint?', 'Rough').':checked')
        ->assertSeeIn($great, '1 · 50%')
        ->assertSeeIn($rough, '1 · 50%')
        ->assertSeeIn($card, '2 responses');

    $bobPage->assertSeeIn($great, '1 · 50%')
        ->assertSeeIn($rough, '1 · 50%')
        ->assertSeeIn($card, '2 responses');

    $bobPage->click(surveysChoice('How was the sprint?', 'Fine'))
        ->assertPresent(surveysRadio('How was the sprint?', 'Fine').':checked')
        ->assertSeeIn($fine, '1 · 50%')
        ->assertSeeIn($great, '0 · 0%');

    $carolPage->assertSeeIn($fine, '1 · 50%')
        ->assertSeeIn($great, '0 · 0%')
        ->assertSeeIn($card, '2 responses');

    expect($survey->responses()->count())->toBe(2);
});

it('takes several answers on a multiple choice survey and shows its results only to those who answered', function () {
    [$retro, , $bob, $aliceParticipant] = surveysBoard();
    $survey = surveysSurvey($retro, $aliceParticipant, 'Which practices helped?', SurveyKind::Multiple, ['Pairing', 'Code review', 'Demos']);
    $card = surveysCard('Which practices helped?');
    $pairing = surveysOption('Which practices helped?', 'Pairing');
    $review = surveysOption('Which practices helped?', 'Code review');
    $demos = surveysOption('Which practices helped?', 'Demos');
    $submit = "{$card} button:has-text(\"Submit\")";
    $showsResults = surveysShowsResults('Which practices helped?');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $bobPage->assertSeeIn($card, 'Multiple choice')
        ->assertDisabled($submit)
        ->click(surveysCheckbox('Which practices helped?', 'Pairing'))
        ->click(surveysCheckbox('Which practices helped?', 'Demos'))
        ->click($submit)
        ->assertSeeIn($pairing, '1 · 100%')
        ->assertSeeIn($demos, '1 · 100%')
        ->assertSeeIn($review, '0 · 0%')
        ->assertSeeIn($card, '1 response')
        ->assertAriaAttribute(surveysCheckbox('Which practices helped?', 'Pairing'), 'checked', 'true')
        ->assertDisabled("{$card} button:has-text(\"Update answer\")");

    $carolPage->assertSeeIn($card, '1 response')
        ->assertScript($showsResults, false);

    $carolPage->click(surveysCheckbox('Which practices helped?', 'Pairing'))
        ->click($submit)
        ->assertSeeIn($pairing, '2 · 100%')
        ->assertSeeIn($demos, '1 · 50%')
        ->assertSeeIn($review, '0 · 0%')
        ->assertSeeIn($card, '2 responses');

    $bobPage->assertSeeIn($pairing, '2 · 100%')
        ->assertSeeIn($demos, '1 · 50%')
        ->assertSeeIn($card, '2 responses');

    expect($survey->responses()->count())->toBe(3)
        ->and($survey->responseCount())->toBe(2);
});

it('lists the free text answers, sorted by text and without names, only to those who answered', function () {
    [$retro, , $bob, $aliceParticipant] = surveysBoard();
    $survey = surveysSurvey($retro, $aliceParticipant, 'What should we try next?', SurveyKind::Text);
    $card = surveysCard('What should we try next?');
    $input = surveysAnswerField('What should we try next?');
    $list = "{$card} ul[aria-label=\"Answers\"]";
    $answers = surveysTextAnswers('What should we try next?');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $bobPage->fill($input, 'Shorter standups')
        ->click("{$card} button:has-text(\"Submit\")")
        ->assertSeeIn($list, 'Shorter standups')
        ->assertSeeIn("{$list} li", 'Your answer')
        ->assertSeeIn($card, '1 response');

    $carolPage->assertSeeIn($card, '1 response')
        ->assertNotPresent($list);

    $carolSnapshot = $this->snapshotOf($carolPage, "/retros/{$retro->id}/snapshot");
    $sent = surveysent($carolSnapshot, 'What should we try next?');

    expect($sent['responseCount'])->toBe(1)
        ->and($sent['resultsVisible'])->toBeFalse()
        ->and($sent['textAnswers'])->toBeNull()
        ->and(json_encode($carolSnapshot, JSON_THROW_ON_ERROR))->not->toContain('Shorter standups');

    $carolPage->fill($input, 'Automate the changelog')
        ->click("{$card} button:has-text(\"Submit\")")
        ->assertScript($answers, 'Automate the changelog | Shorter standups')
        ->assertDontSeeIn($list, 'Bob Stone')
        ->assertSeeIn($card, '2 responses');

    $bobPage->assertScript($answers, 'Automate the changelog | Shorter standups')
        ->assertDontSeeIn($list, 'Carol Guest');

    $bobPage->fill($input, 'Zero meetings on Fridays')
        ->click("{$card} button:has-text(\"Update answer\")")
        ->assertScript($answers, 'Automate the changelog | Zero meetings on Fridays')
        ->assertSeeIn($card, '2 responses');

    $carolPage->assertScript($answers, 'Automate the changelog | Zero meetings on Fridays');

    expect($survey->textAnswers()->pluck('content')->sort()->values()->all())
        ->toBe(['Automate the changelog', 'Zero meetings on Fridays']);
});

it('shows the results to someone who has not answered once the facilitator closes the survey', function () {
    [$retro, $alice, , $aliceParticipant, $bobParticipant] = surveysBoard();
    $survey = surveysSurvey($retro, $aliceParticipant, 'How was the sprint?');
    answerSurvey($survey, $bobParticipant, 0);
    $card = surveysCard('How was the sprint?');
    $great = surveysOption('How was the sprint?', 'Great');
    $actions = "{$card} [aria-label=\"Survey actions\"]";
    $showsResults = surveysShowsResults('How was the sprint?');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertSeeIn($card, '1 response')
        ->assertScript($showsResults, false);

    $alicePage->click($actions)
        ->assertSee('Close survey')
        ->click('Close survey')
        ->assertNotPresent('[role="menu"]')
        ->assertSeeIn($card, 'Closed')
        ->assertSeeIn($great, '1 · 100%');

    $carolPage->assertSeeIn($card, 'Closed')
        ->assertSeeIn($great, '1 · 100%')
        ->assertDisabled(surveysRadio('How was the sprint?', 'Great'))
        ->assertPresent("{$card} button[aria-label^=\"Comments\"]");

    expect($survey->fresh()->is_closed)->toBeTrue();

    $alicePage->click($actions)
        ->assertSee('Reopen survey')
        ->click('Reopen survey')
        ->assertNotPresent('[role="menu"]')
        ->assertDontSeeIn($card, 'Closed');

    $carolPage->assertDontSeeIn($card, 'Closed')
        ->assertScript($showsResults, false)
        ->assertEnabled(surveysRadio('How was the sprint?', 'Great'));

    expect($survey->fresh()->is_closed)->toBeFalse()
        ->and($survey->responses()->count())->toBe(1);
});

it('shows who answered, and who wrote a free text answer, only once the viewer may see the results', function () {
    [$retro, $alice, , $aliceParticipant, $bobParticipant] = surveysBoard();
    $choice = surveysSurvey($retro, $aliceParticipant, 'How was the sprint?');
    $freeText = surveysSurvey($retro, $aliceParticipant, 'What should we try next?', SurveyKind::Text);
    answerSurvey($choice, $bobParticipant, 0);
    SurveyTextAnswer::factory()->create([
        'survey_id' => $freeText->id,
        'participant_id' => $bobParticipant->id,
        'content' => 'Shorter standups',
    ]);
    $single = surveysCard('How was the sprint?');
    $text = surveysCard('What should we try next?');
    $great = surveysOption('How was the sprint?', 'Great');
    $rough = surveysOption('How was the sprint?', 'Rough');
    $answers = "{$text} ul[aria-label=\"Answers\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->click("{$single} [aria-label=\"Survey actions\"]")
        ->assertPresent('[role="menuitemcheckbox"]')
        ->click('[role="menuitemcheckbox"]')
        ->assertNotPresent('[role="menu"]')
        ->assertEnabled("{$single} [aria-label=\"Survey actions\"]");

    surveysAwaitShowVoters($alicePage, 'How was the sprint?')
        ->assertNotPresent("{$single} img");

    foreach ([$alicePage, $carolPage] as $page) {
        $sent = surveysent($this->snapshotOf($page, "/retros/{$retro->id}/snapshot"), 'How was the sprint?');

        expect($sent['showVoters'])->toBeTrue()
            ->and($sent['resultsVisible'])->toBeFalse()
            ->and($sent['responseCount'])->toBe(1)
            ->and(array_column($sent['options'], 'count'))->toBe([null, null, null])
            ->and(array_column($sent['options'], 'voters'))->toBe([null, null, null]);
    }

    $alicePage->click(surveysChoice('How was the sprint?', 'Great'))
        ->assertSeeIn($great, '2 · 100%')
        ->assertPresent("{$great} img[alt=\"Bob Stone\"]")
        ->assertPresent("{$great} img[alt=\"Alice Martin\"]");

    $carolPage->assertSeeIn($single, '2 responses')
        ->assertNotPresent("{$single} img");

    $carolPage->click(surveysChoice('How was the sprint?', 'Rough'))
        ->assertSeeIn($rough, '1 · 33%')
        ->assertPresent("{$great} img[alt=\"Bob Stone\"]")
        ->assertPresent("{$great} img[alt=\"Alice Martin\"]")
        ->assertPresent("{$rough} img[alt=\"Carol Guest\"]")
        ->assertNotPresent("{$rough} img[alt=\"Bob Stone\"]");

    $alicePage->click("{$text} [aria-label=\"Survey actions\"]")
        ->assertPresent('[role="menuitemcheckbox"]')
        ->click('[role="menuitemcheckbox"]')
        ->assertNotPresent('[role="menu"]')
        ->assertEnabled("{$text} [aria-label=\"Survey actions\"]");

    surveysAwaitShowVoters($alicePage, 'What should we try next?');

    $carolSnapshot = $this->snapshotOf($carolPage, "/retros/{$retro->id}/snapshot");
    $sent = surveysent($carolSnapshot, 'What should we try next?');

    expect($sent['showVoters'])->toBeTrue()
        ->and($sent['resultsVisible'])->toBeFalse()
        ->and($sent['responseCount'])->toBe(1)
        ->and($sent['textAnswers'])->toBeNull()
        ->and(json_encode($carolSnapshot, JSON_THROW_ON_ERROR))->not->toContain('Shorter standups');

    $carolPage->assertNotPresent($answers)
        ->assertDontSeeIn($text, 'Shorter standups');

    $carolPage->fill(surveysAnswerField('What should we try next?'), 'Automate the changelog')
        ->click("{$text} button:has-text(\"Submit\")")
        ->assertSeeIn("{$answers} li:has-text(\"Shorter standups\")", 'Bob Stone')
        ->assertSeeIn("{$answers} li:has-text(\"Automate the changelog\")", 'Carol Guest');

    expect($choice->fresh()->show_voters)->toBeTrue()
        ->and($freeText->fresh()->show_voters)->toBeTrue();
});

it('never offers or shows who answered on an anonymous retro', function () {
    [$retro, $alice, , $aliceParticipant, $bobParticipant] = surveysBoard(RetroPhase::Writing, ['is_anonymous' => true]);
    $survey = surveysSurvey($retro, $aliceParticipant, 'How was the sprint?', attributes: ['show_voters' => true]);
    answerSurvey($survey, $bobParticipant, 0);
    $card = surveysCard('How was the sprint?');
    $great = surveysOption('How was the sprint?', 'Great');

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click("{$card} [aria-label=\"Survey actions\"]")
        ->assertAttribute('[role="menuitemcheckbox"]', 'aria-disabled', 'true')
        ->assertAriaAttribute('[role="menuitemcheckbox"]', 'checked', 'false')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]');

    $page->click(surveysChoice('How was the sprint?', 'Great'))
        ->assertSeeIn($great, '2 · 100%')
        ->assertNotPresent("{$card} img");

    openQuickPoll($page)
        ->assertVisible('#survey-show-voters')
        ->assertDisabled('#survey-show-voters')
        ->assertAriaAttribute('#survey-show-voters', 'checked', 'false')
        ->assertSee('Names are never shown on anonymous retros.');
});

it('hides the reactions and comments of a survey from someone who has not answered it', function () {
    [$retro, , $bob, $aliceParticipant, $bobParticipant] = surveysBoard();
    $survey = surveysSurvey($retro, $aliceParticipant, 'How was the sprint?');
    answerSurvey($survey, $bobParticipant, 0);
    $card = surveysCard('How was the sprint?');
    $fine = surveysOption('How was the sprint?', 'Fine');
    $comments = "{$card} button[aria-label^=\"Comments\"]";
    $composer = "{$card} [aria-label=\"Write a comment…\"]";

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $bobPage->click("{$card} [aria-label=\"Add a reaction\"]")
        ->assertPresent('[role="menu"]')
        ->click('[role="menuitem"]:has-text("🎉")')
        ->assertNotPresent('[role="menu"]')
        ->assertAriaAttribute("{$card} [aria-label=\"🎉, 1 reaction\"]", 'pressed', 'true');

    $bobPage->click($comments)
        ->assertSeeIn($card, 'Your name is shown with your comment.')
        ->fill($composer, 'Pairing saved us')
        ->keys($composer, 'Enter')
        ->assertSeeIn($card, 'Pairing saved us')
        ->assertSeeIn($card, 'Bob Stone')
        ->assertPresent("{$card} button[aria-label=\"Comments (1)\"]");

    $carolPage->assertSeeIn($card, '1 · Answer to join the discussion')
        ->assertDontSeeIn($card, 'Pairing saved us')
        ->assertNotPresent("{$card} [aria-label^=\"🎉\"]")
        ->assertNotPresent("{$card} [aria-label=\"Add a reaction\"]")
        ->assertNotPresent($comments);

    $carolSnapshot = $this->snapshotOf($carolPage, "/retros/{$retro->id}/snapshot");
    $sent = surveysent($carolSnapshot, 'How was the sprint?');

    expect($sent['resultsVisible'])->toBeFalse()
        ->and($sent['commentCount'])->toBe(1)
        ->and($sent['comments'])->toBe([])
        ->and($sent['reactions'])->toBe([])
        ->and(json_encode($carolSnapshot, JSON_THROW_ON_ERROR))->not->toContain('Pairing saved us');

    $carolPage->click(surveysChoice('How was the sprint?', 'Fine'))
        ->assertSeeIn($fine, '1 · 50%')
        ->assertAriaAttribute("{$card} [aria-label=\"🎉, 1 reaction\"]", 'pressed', 'false')
        ->click($comments)
        ->assertSeeIn($card, 'Pairing saved us')
        ->assertSeeIn($card, 'Bob Stone');

    $carolPage->click("{$card} [aria-label=\"🎉, 1 reaction\"]")
        ->assertAriaAttribute("{$card} [aria-label=\"🎉, 2 reactions\"]", 'pressed', 'true');

    $carolPage->fill($composer, 'Same here')
        ->keys($composer, 'Enter')
        ->assertSeeIn($card, 'Same here')
        ->assertPresent("{$card} button[aria-label=\"Comments (2)\"]");

    $bobPage->assertPresent("{$card} [aria-label=\"🎉, 2 reactions\"]")
        ->assertSeeIn($card, 'Same here')
        ->assertSeeIn($card, 'Carol Guest')
        ->assertPresent("{$card} button[aria-label=\"Comments (2)\"]");

    expect($survey->reactions()->count())->toBe(2)
        ->and($survey->comments()->pluck('content')->all())->toBe(['Pairing saved us', 'Same here']);
});

it('hides the results and the discussion again when an answer is withdrawn', function () {
    [$retro, , $bob, $aliceParticipant, $bobParticipant] = surveysBoard();
    $survey = surveysSurvey($retro, $aliceParticipant, 'How was the sprint?');
    answerSurvey($survey, $aliceParticipant, 0);
    answerSurvey($survey, $bobParticipant, 1);
    SurveyReaction::factory()->create([
        'retro_id' => $retro->id,
        'survey_id' => $survey->id,
        'participant_id' => $aliceParticipant->id,
        'emoji' => '👍',
    ]);
    SurveyComment::factory()->create([
        'retro_id' => $retro->id,
        'survey_id' => $survey->id,
        'participant_id' => $aliceParticipant->id,
        'content' => 'Pairing saved us',
    ]);
    $card = surveysCard('How was the sprint?');
    $rough = surveysOption('How was the sprint?', 'Rough');
    $comments = "{$card} button[aria-label^=\"Comments\"]";
    $showsResults = surveysShowsResults('How was the sprint?');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->click(surveysChoice('How was the sprint?', 'Rough'))
        ->assertSeeIn($rough, '1 · 33%')
        ->assertSeeIn($card, '3 responses')
        ->assertPresent("{$card} [aria-label=\"👍, 1 reaction\"]")
        ->click($comments)
        ->assertSeeIn($card, 'Pairing saved us');

    $bobPage->assertSeeIn($rough, '1 · 33%')
        ->assertSeeIn($card, '3 responses');

    $carolPage->click("{$card} button:has-text(\"Withdraw my answer\")")
        ->assertSeeIn($card, '2 responses')
        ->assertScript($showsResults, false)
        ->assertSeeIn($card, '1 · Answer to join the discussion')
        ->assertDontSeeIn($card, 'Pairing saved us')
        ->assertNotPresent("{$card} [aria-label=\"👍, 1 reaction\"]")
        ->assertNotPresent($comments)
        ->assertCount("{$card} button[aria-pressed=\"true\"]", 0)
        ->assertDontSeeIn($card, 'Withdraw my answer');

    $bobPage->assertSeeIn($card, '2 responses')
        ->assertSeeIn($rough, '0 · 0%');

    expect($survey->responses()->count())->toBe(2)
        ->and($survey->reactions()->count())->toBe(1)
        ->and($survey->comments()->count())->toBe(1);
});

it('closes every survey when the retro is completed and keeps them closed after a reopen', function () {
    [$retro, $alice, , $aliceParticipant, $bobParticipant] = surveysBoard(RetroPhase::Discussing);
    $choice = surveysSurvey($retro, $aliceParticipant, 'How was the sprint?');
    surveysSurvey($retro, $aliceParticipant, 'Which practices helped?', SurveyKind::Multiple, ['Pairing', 'Demos']);
    surveysSurvey($retro, $aliceParticipant, 'What should we try next?', SurveyKind::Text);
    answerSurvey($choice, $bobParticipant, 0);
    $single = surveysCard('How was the sprint?');
    $multiple = surveysCard('Which practices helped?');
    $text = surveysCard('What should we try next?');
    $great = surveysOption('How was the sprint?', 'Great');
    $pairing = surveysOption('Which practices helped?', 'Pairing');
    $results = 'section:has(h2:has-text("Surveys"))';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertCount('section[aria-label="Surveys"] article', 3)
        ->assertDontSeeIn($single, 'Closed');

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Completed')
            ->assertCount("{$results} article", 3)
            ->assertSeeIn($great, '1 · 100%')
            ->assertSeeIn($single, '1 response')
            ->assertSeeIn($text, 'No answers yet.')
            ->assertNotPresent('[aria-label="Survey actions"]')
            ->assertNotPresent('section[aria-label="Surveys"] textarea');
    }

    expect($retro->surveys()->where('is_closed', false)->count())->toBe(0);

    $alicePage->press('Reopen')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->press('Previous')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->press('Previous')
        ->assertSeeIn('[aria-current="step"]', 'Discussing');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Discussing')
            ->assertCount('section[aria-label="Surveys"] article', 3)
            ->assertSeeIn($single, 'Closed')
            ->assertSeeIn($multiple, 'Closed')
            ->assertSeeIn($text, 'Closed')
            ->assertSeeIn($great, '1 · 100%')
            ->assertDisabled(surveysRadio('How was the sprint?', 'Great'))
            ->assertDisabled(surveysCheckbox('Which practices helped?', 'Pairing'))
            ->assertNotPresent("{$multiple} button:has-text(\"Submit\")")
            ->assertDisabled(surveysAnswerField('What should we try next?'));
    }

    $alicePage->click("{$single} [aria-label=\"Survey actions\"]")
        ->assertSee('Reopen survey')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]');

    expect($retro->surveys()->where('is_closed', false)->count())->toBe(0)
        ->and($choice->responses()->count())->toBe(1)
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Discussing);
});
