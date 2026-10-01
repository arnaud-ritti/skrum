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
function p08cBoard(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
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
function p08cSurvey(Retro $retro, Participant $creator, string $question, SurveyKind $kind = SurveyKind::Single, array $options = ['Great', 'Fine', 'Rough'], array $attributes = []): Survey
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

function p08cCard(string $question): string
{
    return "article[aria-label=\"{$question}\"]";
}

function p08cOption(string $question, string $label): string
{
    return p08cCard($question)." li:has-text(\"{$label}\")";
}

function p08cShowsResults(string $question): string
{
    $card = p08cCard($question);

    return "document.querySelector('{$card}').innerText.includes('%')";
}

function p08cTextAnswers(string $question): string
{
    $answers = p08cCard($question).' ul[aria-label="Answers"] li';

    return "[...document.querySelectorAll('{$answers}')].map((answer) => answer.firstChild.textContent).join(' | ')";
}

/**
 * @param  array<string, mixed>  $snapshot
 * @return array<string, mixed>
 */
function p08cSurveySent(array $snapshot, string $question): array
{
    return collect($snapshot['surveys'])->firstOrFail('question', $question);
}

function p08cAwaitShowVoters(mixed $page, string $question): mixed
{
    $actions = p08cCard($question).' [aria-label="Survey actions"]';

    $page->click($actions)
        ->assertAriaAttribute('[role="menuitemcheckbox"]', 'checked', 'true')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]');

    return $page;
}

it('[P08c-01]creates a single choice, a multiple choice and a free text survey that a guest sees without reloading', function () {
    [$retro, $alice] = p08cBoard();
    $single = p08cCard('How was the sprint?');
    $multiple = p08cCard('Which practices helped?');
    $text = p08cCard('What should we try next?');
    $save = '[role="dialog"] button[type="submit"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertNotPresent('section[aria-label="Surveys"]')
        ->assertDontSee('Add survey');

    $alicePage->assertSee('Add survey')
        ->click('Add survey')
        ->assertVisible('#survey-question')
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
        ->assertCount("{$single} button[aria-pressed]", 3)
        ->assertSeeIn($single, '0 responses')
        ->assertSeeIn($single, 'Answer to join the discussion');

    $alicePage->click('Add survey')
        ->assertVisible('#survey-kind')
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
        ->assertSeeIn($multiple, 'Several answers allowed')
        ->assertCount("{$multiple} button[role=\"checkbox\"]", 2)
        ->assertDisabled("{$multiple} button:has-text(\"Submit\")");

    $alicePage->click('Add survey')
        ->assertVisible('#survey-kind')
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
        ->assertPresent("{$text} [aria-label=\"Your answer\"]")
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

it('[P08c-02a] shows the results of a single choice survey only to those who answered', function () {
    [$retro, , $bob, $aliceParticipant] = p08cBoard();
    $survey = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?');
    $card = p08cCard('How was the sprint?');
    $great = p08cOption('How was the sprint?', 'Great');
    $fine = p08cOption('How was the sprint?', 'Fine');
    $rough = p08cOption('How was the sprint?', 'Rough');
    $showsResults = p08cShowsResults('How was the sprint?');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertSeeIn($card, '0 responses')
            ->assertScript($showsResults, false);
    }

    $bobPage->click("{$great} button")
        ->assertAriaAttribute("{$great} button", 'pressed', 'true')
        ->assertSeeIn($great, '100% · 1')
        ->assertSeeIn($fine, '0% · 0')
        ->assertSeeIn($card, '1 response')
        ->assertSeeIn($card, 'Withdraw my answer');

    $carolPage->assertSeeIn($card, '1 response')
        ->assertScript($showsResults, false)
        ->assertDontSeeIn($card, 'Withdraw my answer');

    $carolPage->click("{$rough} button")
        ->assertAriaAttribute("{$rough} button", 'pressed', 'true')
        ->assertSeeIn($great, '50% · 1')
        ->assertSeeIn($rough, '50% · 1')
        ->assertSeeIn($card, '2 responses');

    $bobPage->assertSeeIn($great, '50% · 1')
        ->assertSeeIn($rough, '50% · 1')
        ->assertSeeIn($card, '2 responses');

    $bobPage->click("{$fine} button")
        ->assertAriaAttribute("{$fine} button", 'pressed', 'true')
        ->assertSeeIn($fine, '50% · 1')
        ->assertSeeIn($great, '0% · 0');

    $carolPage->assertSeeIn($fine, '50% · 1')
        ->assertSeeIn($great, '0% · 0')
        ->assertSeeIn($card, '2 responses');

    expect($survey->responses()->count())->toBe(2);
});

it('[P08c-02b] takes several answers on a multiple choice survey and shows its results only to those who answered', function () {
    [$retro, , $bob, $aliceParticipant] = p08cBoard();
    $survey = p08cSurvey($retro, $aliceParticipant, 'Which practices helped?', SurveyKind::Multiple, ['Pairing', 'Code review', 'Demos']);
    $card = p08cCard('Which practices helped?');
    $pairing = p08cOption('Which practices helped?', 'Pairing');
    $review = p08cOption('Which practices helped?', 'Code review');
    $demos = p08cOption('Which practices helped?', 'Demos');
    $submit = "{$card} button:has-text(\"Submit\")";
    $showsResults = p08cShowsResults('Which practices helped?');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $bobPage->assertSeeIn($card, 'Several answers allowed')
        ->assertDisabled($submit)
        ->click("{$pairing} button[role=\"checkbox\"]")
        ->click("{$demos} button[role=\"checkbox\"]")
        ->click($submit)
        ->assertSeeIn($pairing, '100% · 1')
        ->assertSeeIn($demos, '100% · 1')
        ->assertSeeIn($review, '0% · 0')
        ->assertSeeIn($card, '1 response')
        ->assertAriaAttribute("{$pairing} button[role=\"checkbox\"]", 'checked', 'true')
        ->assertDisabled("{$card} button:has-text(\"Update answer\")");

    $carolPage->assertSeeIn($card, '1 response')
        ->assertScript($showsResults, false);

    $carolPage->click("{$pairing} button[role=\"checkbox\"]")
        ->click($submit)
        ->assertSeeIn($pairing, '100% · 2')
        ->assertSeeIn($demos, '50% · 1')
        ->assertSeeIn($review, '0% · 0')
        ->assertSeeIn($card, '2 responses');

    $bobPage->assertSeeIn($pairing, '100% · 2')
        ->assertSeeIn($demos, '50% · 1')
        ->assertSeeIn($card, '2 responses');

    expect($survey->responses()->count())->toBe(3)
        ->and($survey->responseCount())->toBe(2);
});

it('[P08c-02c] lists the free text answers, sorted by text and without names, only to those who answered', function () {
    [$retro, , $bob, $aliceParticipant] = p08cBoard();
    $survey = p08cSurvey($retro, $aliceParticipant, 'What should we try next?', SurveyKind::Text);
    $card = p08cCard('What should we try next?');
    $input = "{$card} [aria-label=\"Your answer\"]";
    $list = "{$card} ul[aria-label=\"Answers\"]";
    $answers = p08cTextAnswers('What should we try next?');

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
    $sent = p08cSurveySent($carolSnapshot, 'What should we try next?');

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

it('[P08c-03] shows the results to someone who has not answered once the facilitator closes the survey', function () {
    [$retro, $alice, , $aliceParticipant, $bobParticipant] = p08cBoard();
    $survey = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?');
    answerSurvey($survey, $bobParticipant, 0);
    $card = p08cCard('How was the sprint?');
    $great = p08cOption('How was the sprint?', 'Great');
    $actions = "{$card} [aria-label=\"Survey actions\"]";
    $showsResults = p08cShowsResults('How was the sprint?');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertSeeIn($card, '1 response')
        ->assertScript($showsResults, false);

    $alicePage->click($actions)
        ->assertSee('Close survey')
        ->click('Close survey')
        ->assertNotPresent('[role="menu"]')
        ->assertSeeIn($card, 'Closed')
        ->assertSeeIn($great, '100% · 1');

    $carolPage->assertSeeIn($card, 'Closed')
        ->assertSeeIn($great, '100% · 1')
        ->assertDisabled("{$great} button")
        ->assertPresent("{$card} button[aria-label^=\"Comments\"]");

    expect($survey->fresh()->is_closed)->toBeTrue();

    $alicePage->click($actions)
        ->assertSee('Reopen survey')
        ->click('Reopen survey')
        ->assertNotPresent('[role="menu"]')
        ->assertDontSeeIn($card, 'Closed');

    $carolPage->assertDontSeeIn($card, 'Closed')
        ->assertScript($showsResults, false)
        ->assertEnabled("{$great} button");

    expect($survey->fresh()->is_closed)->toBeFalse()
        ->and($survey->responses()->count())->toBe(1);
});

it('[P08c-04a] shows who answered, and who wrote a free text answer, only once the viewer may see the results', function () {
    [$retro, $alice, , $aliceParticipant, $bobParticipant] = p08cBoard();
    $choice = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?');
    $freeText = p08cSurvey($retro, $aliceParticipant, 'What should we try next?', SurveyKind::Text);
    answerSurvey($choice, $bobParticipant, 0);
    SurveyTextAnswer::factory()->create([
        'survey_id' => $freeText->id,
        'participant_id' => $bobParticipant->id,
        'content' => 'Shorter standups',
    ]);
    $single = p08cCard('How was the sprint?');
    $text = p08cCard('What should we try next?');
    $great = p08cOption('How was the sprint?', 'Great');
    $rough = p08cOption('How was the sprint?', 'Rough');
    $answers = "{$text} ul[aria-label=\"Answers\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->click("{$single} [aria-label=\"Survey actions\"]")
        ->assertPresent('[role="menuitemcheckbox"]')
        ->click('[role="menuitemcheckbox"]')
        ->assertNotPresent('[role="menu"]')
        ->assertEnabled("{$single} [aria-label=\"Survey actions\"]");

    p08cAwaitShowVoters($alicePage, 'How was the sprint?')
        ->assertNotPresent("{$single} img");

    foreach ([$alicePage, $carolPage] as $page) {
        $sent = p08cSurveySent($this->snapshotOf($page, "/retros/{$retro->id}/snapshot"), 'How was the sprint?');

        expect($sent['showVoters'])->toBeTrue()
            ->and($sent['resultsVisible'])->toBeFalse()
            ->and($sent['responseCount'])->toBe(1)
            ->and(array_column($sent['options'], 'count'))->toBe([null, null, null])
            ->and(array_column($sent['options'], 'voters'))->toBe([null, null, null]);
    }

    $alicePage->click("{$great} button")
        ->assertSeeIn($great, '100% · 2')
        ->assertPresent("{$great} img[alt=\"Bob Stone\"]")
        ->assertPresent("{$great} img[alt=\"Alice Martin\"]");

    $carolPage->assertSeeIn($single, '2 responses')
        ->assertNotPresent("{$single} img");

    $carolPage->click("{$rough} button")
        ->assertSeeIn($rough, '33% · 1')
        ->assertPresent("{$great} img[alt=\"Bob Stone\"]")
        ->assertPresent("{$great} img[alt=\"Alice Martin\"]")
        ->assertPresent("{$rough} img[alt=\"Carol Guest\"]")
        ->assertNotPresent("{$rough} img[alt=\"Bob Stone\"]");

    $alicePage->click("{$text} [aria-label=\"Survey actions\"]")
        ->assertPresent('[role="menuitemcheckbox"]')
        ->click('[role="menuitemcheckbox"]')
        ->assertNotPresent('[role="menu"]')
        ->assertEnabled("{$text} [aria-label=\"Survey actions\"]");

    p08cAwaitShowVoters($alicePage, 'What should we try next?');

    $carolSnapshot = $this->snapshotOf($carolPage, "/retros/{$retro->id}/snapshot");
    $sent = p08cSurveySent($carolSnapshot, 'What should we try next?');

    expect($sent['showVoters'])->toBeTrue()
        ->and($sent['resultsVisible'])->toBeFalse()
        ->and($sent['responseCount'])->toBe(1)
        ->and($sent['textAnswers'])->toBeNull()
        ->and(json_encode($carolSnapshot, JSON_THROW_ON_ERROR))->not->toContain('Shorter standups');

    $carolPage->assertNotPresent($answers)
        ->assertDontSeeIn($text, 'Shorter standups');

    $carolPage->fill("{$text} [aria-label=\"Your answer\"]", 'Automate the changelog')
        ->click("{$text} button:has-text(\"Submit\")")
        ->assertSeeIn("{$answers} li:has-text(\"Shorter standups\")", 'Bob Stone')
        ->assertSeeIn("{$answers} li:has-text(\"Automate the changelog\")", 'Carol Guest');

    expect($choice->fresh()->show_voters)->toBeTrue()
        ->and($freeText->fresh()->show_voters)->toBeTrue();
});

it('[P08c-04b] never offers or shows who answered on an anonymous retro', function () {
    [$retro, $alice, , $aliceParticipant, $bobParticipant] = p08cBoard(RetroPhase::Writing, ['is_anonymous' => true]);
    $survey = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?', attributes: ['show_voters' => true]);
    answerSurvey($survey, $bobParticipant, 0);
    $card = p08cCard('How was the sprint?');
    $great = p08cOption('How was the sprint?', 'Great');

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click("{$card} [aria-label=\"Survey actions\"]")
        ->assertAttribute('[role="menuitemcheckbox"]', 'aria-disabled', 'true')
        ->assertAriaAttribute('[role="menuitemcheckbox"]', 'checked', 'false')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]');

    $page->click("{$great} button")
        ->assertSeeIn($great, '100% · 2')
        ->assertNotPresent("{$card} img");

    $page->click('Add survey')
        ->assertVisible('#survey-show-voters')
        ->assertDisabled('#survey-show-voters')
        ->assertAriaAttribute('#survey-show-voters', 'checked', 'false')
        ->assertSee('Names are never shown on anonymous retros.');
});

it('[P08c-05] hides the reactions and comments of a survey from someone who has not answered it', function () {
    [$retro, , $bob, $aliceParticipant, $bobParticipant] = p08cBoard();
    $survey = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?');
    answerSurvey($survey, $bobParticipant, 0);
    $card = p08cCard('How was the sprint?');
    $fine = p08cOption('How was the sprint?', 'Fine');
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
    $sent = p08cSurveySent($carolSnapshot, 'How was the sprint?');

    expect($sent['resultsVisible'])->toBeFalse()
        ->and($sent['commentCount'])->toBe(1)
        ->and($sent['comments'])->toBe([])
        ->and($sent['reactions'])->toBe([])
        ->and(json_encode($carolSnapshot, JSON_THROW_ON_ERROR))->not->toContain('Pairing saved us');

    $carolPage->click("{$fine} button")
        ->assertSeeIn($fine, '50% · 1')
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

it('[P08c-06] hides the results and the discussion again when an answer is withdrawn', function () {
    [$retro, , $bob, $aliceParticipant, $bobParticipant] = p08cBoard();
    $survey = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?');
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
    $card = p08cCard('How was the sprint?');
    $rough = p08cOption('How was the sprint?', 'Rough');
    $comments = "{$card} button[aria-label^=\"Comments\"]";
    $showsResults = p08cShowsResults('How was the sprint?');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->click("{$rough} button")
        ->assertSeeIn($rough, '33% · 1')
        ->assertSeeIn($card, '3 responses')
        ->assertPresent("{$card} [aria-label=\"👍, 1 reaction\"]")
        ->click($comments)
        ->assertSeeIn($card, 'Pairing saved us');

    $bobPage->assertSeeIn($rough, '33% · 1')
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
        ->assertSeeIn($rough, '0% · 0');

    expect($survey->responses()->count())->toBe(2)
        ->and($survey->reactions()->count())->toBe(1)
        ->and($survey->comments()->count())->toBe(1);
});

it('[P08c-07] closes every survey when the retro is completed and keeps them closed after a reopen', function () {
    [$retro, $alice, , $aliceParticipant, $bobParticipant] = p08cBoard(RetroPhase::Discussing);
    $choice = p08cSurvey($retro, $aliceParticipant, 'How was the sprint?');
    p08cSurvey($retro, $aliceParticipant, 'Which practices helped?', SurveyKind::Multiple, ['Pairing', 'Demos']);
    p08cSurvey($retro, $aliceParticipant, 'What should we try next?', SurveyKind::Text);
    answerSurvey($choice, $bobParticipant, 0);
    $single = p08cCard('How was the sprint?');
    $multiple = p08cCard('Which practices helped?');
    $text = p08cCard('What should we try next?');
    $great = p08cOption('How was the sprint?', 'Great');
    $pairing = p08cOption('Which practices helped?', 'Pairing');
    $results = 'section:has(h2:has-text("Surveys"))';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertCount('section[aria-label="Surveys"] article', 3)
        ->assertDontSeeIn($single, 'Closed');

    $alicePage->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Completed')
            ->assertCount("{$results} article", 3)
            ->assertSeeIn($great, '100% · 1')
            ->assertSeeIn($single, '1 response')
            ->assertSeeIn($text, 'No answers yet.')
            ->assertNotPresent('[aria-label="Survey actions"]')
            ->assertNotPresent('[aria-label="Your answer"]');
    }

    expect($retro->surveys()->where('is_closed', false)->count())->toBe(0);

    $alicePage->press('Reopen')
        ->assertSeeIn('[aria-current="step"]', 'Discussing');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Discussing')
            ->assertCount('section[aria-label="Surveys"] article', 3)
            ->assertSeeIn($single, 'Closed')
            ->assertSeeIn($multiple, 'Closed')
            ->assertSeeIn($text, 'Closed')
            ->assertSeeIn($great, '100% · 1')
            ->assertDisabled("{$great} button")
            ->assertDisabled("{$pairing} button[role=\"checkbox\"]")
            ->assertNotPresent("{$multiple} button:has-text(\"Submit\")")
            ->assertNotPresent("{$text} [aria-label=\"Your answer\"]");
    }

    $alicePage->click("{$single} [aria-label=\"Survey actions\"]")
        ->assertSee('Reopen survey')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]');

    expect($retro->surveys()->where('is_closed', false)->count())->toBe(0)
        ->and($choice->responses()->count())->toBe(1)
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Discussing);
});
