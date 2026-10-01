<?php

use App\Enums\RetroPhase;
use App\Enums\SurveyKind;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
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

it('[P08c-01] creates a single choice, a multiple choice and a free text survey that a guest sees without reloading', function () {
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
        ->assertNotPresent($list)
        ->assertScript('document.documentElement.outerHTML.includes("Shorter standups")', false);

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
