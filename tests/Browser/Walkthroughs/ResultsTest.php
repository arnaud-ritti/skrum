<?php

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyReaction;
use App\Models\SurveyTextAnswer;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;
use Carbon\CarbonInterface;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: array<int, Column>,
 *     2: User,
 *     3: User,
 *     4: Participant,
 *     5: Participant
 * }
 */
function resultsBoard(RetroPhase $phase = RetroPhase::Discussing, array $attributes = [], ?Team $team = null): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withGuestAccess()
        ->create([
            'team_id' => $team ?? Team::factory(),
            'title' => 'Sprint 12',
            'completed_at' => $phase === RetroPhase::Completed ? now() : null,
            ...$attributes,
        ]);

    $columns = [];

    foreach (['Start', 'Stop'] as $position => $title) {
        $columns[] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $columns, $alice, $bob, $aliceParticipant, $bobParticipant];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function resultsCard(Retro $retro, Column $column, Participant $author, string $content, array $attributes = []): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'position' => 0,
        ...$attributes,
    ]);
}

function resultsInSection(string $title, string $expression): string
{
    return "(() => { const section = [...document.querySelectorAll('section')].find((candidate) => candidate.querySelector('h2')?.textContent === '{$title}'); return {$expression}; })()";
}

/**
 * @param  array<string, int>  $scores
 */
function resultsPastRetro(Team $team, string $title, CarbonInterface $completedAt, array $scores): Retro
{
    $retro = Retro::factory()
        ->withHealthCheck()
        ->inPhase(RetroPhase::Completed)
        ->create(['team_id' => $team->id, 'title' => $title, 'completed_at' => $completedAt]);

    answerHealthCheck($retro, Participant::factory()->create(['retro_id' => $retro->id]), $scores);
    closeHealthCheck($retro);

    return $retro;
}

function resultsOpenHealthDetails(mixed $page): mixed
{
    $page->click('[data-slot="health-check-compact"] button:has-text("Details")')
        ->assertVisible('[role="dialog"] [data-slot="health-check-results"]');

    return $page;
}

function resultsRadar(string $expression): string
{
    return "(() => { const svg = document.querySelector('svg[aria-label=\"Team health radar\"]'); return {$expression}; })()";
}

it('shows a group name typed by a guest to the member without reloading', function () {
    [$retro, $columns, $alice, , , $bobParticipant] = resultsBoard(RetroPhase::Grouping);
    $lead = resultsCard($retro, $columns[0], $bobParticipant, 'Slow CI');
    resultsCard($retro, $columns[0], $bobParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);
    $group = "#group-{$lead->id}";
    $editor = '[aria-label="Group name"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertPresent("{$group} button:has-text(\"Name this group\")");

    $carolPage->assertPresent("{$group} button:has-text(\"Name this group\")")
        ->click("{$group} button:has-text(\"Name this group\")")
        ->assertVisible($editor)
        ->fill($editor, 'Pipeline')
        ->keys($editor, 'Enter')
        ->assertNotPresent($editor)
        ->assertSeeIn("{$group} [aria-label=\"Rename group\"]", 'Pipeline');

    $alicePage->assertSeeIn("{$group} [aria-label=\"Rename group\"]", 'Pipeline')
        ->assertNotPresent("{$group} button:has-text(\"Name this group\")");

    expect($lead->fresh()->group_name)->toBe('Pipeline');
});

it('drops the group name in both browsers when the only grouped card leaves the group', function () {
    [$retro, $columns, $alice, , , $bobParticipant] = resultsBoard(RetroPhase::Grouping);
    $lead = resultsCard($retro, $columns[0], $bobParticipant, 'Slow CI', ['group_name' => 'Pipeline']);
    $child = resultsCard($retro, $columns[0], $bobParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn("#group-{$lead->id} [aria-label=\"Rename group\"]", 'Pipeline');
    }

    $carolPage->click("#card-{$child->id} [aria-label=\"Ungroup\"]");

    foreach ([$carolPage, $alicePage] as $page) {
        $page->assertNotPresent("#group-{$lead->id} #card-{$child->id}")
            ->assertPresent("#card-{$child->id}")
            ->assertDontSee('Pipeline')
            ->assertNotPresent('[aria-label="Rename group"]')
            ->assertNotPresent('button:has-text("Name this group")');
    }

    expect($lead->fresh()->group_name)->toBeNull()
        ->and($child->fresh()->parent_card_id)->toBeNull();
});

it('keeps only the target name when a named group is grouped onto another named group', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = resultsBoard(RetroPhase::Grouping);
    $quality = resultsCard($retro, $columns[0], $bobParticipant, 'Missing tests', ['group_name' => 'Quality', 'position' => 0]);
    $deploys = resultsCard($retro, $columns[0], $bobParticipant, 'Slow CI', ['group_name' => 'Deploys', 'position' => 1]);
    $deploysChild = resultsCard($retro, $columns[0], $bobParticipant, 'Manual releases', ['parent_card_id' => $deploys->id]);
    resultsCard($retro, $columns[0], $bobParticipant, 'No code review', ['parent_card_id' => $quality->id]);
    $handle = "@retro-card-handle-{$deploys->id}";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSeeIn("#group-{$deploys->id} [aria-label=\"Rename group\"]", 'Deploys')
        ->assertSeeIn("#group-{$quality->id} [aria-label=\"Rename group\"]", 'Quality')
        ->assertPresent($handle);

    $this->dragWithKeyboard($bobPage, $handle, ['Space', 'ArrowUp', 'Space'], handleRemains: false);

    foreach ([$bobPage, $alicePage] as $page) {
        $page->assertPresent("#group-{$quality->id} #card-{$deploys->id}")
            ->assertPresent("#group-{$quality->id} #card-{$deploysChild->id}")
            ->assertSeeIn("#group-{$quality->id} [aria-label=\"Rename group\"]", 'Quality')
            ->assertCount('[aria-label="Rename group"]', 1)
            ->assertDontSee('Deploys');
    }

    expect($deploys->fresh()->parent_card_id)->toBe($quality->id)
        ->and($deploys->fresh()->group_name)->toBeNull()
        ->and($deploysChild->fresh()->parent_card_id)->toBe($quality->id)
        ->and($quality->fresh()->group_name)->toBe('Quality');
});

it('renames a group inline for everyone', function (string $phase) {
    [$retro, $columns, $alice, , , $bobParticipant] = resultsBoard(RetroPhase::from($phase));
    $lead = resultsCard($retro, $columns[0], $bobParticipant, 'Slow CI', ['group_name' => 'Pipeline']);
    resultsCard($retro, $columns[0], $bobParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);
    $rename = "#group-{$lead->id} [aria-label=\"Rename group\"]";
    $editor = '[aria-label="Group name"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertSeeIn($rename, 'Pipeline');

    $carolPage->assertSeeIn($rename, 'Pipeline')
        ->click($rename)
        ->assertValue($editor, 'Pipeline')
        ->fill($editor, 'Delivery')
        ->keys($editor, 'Enter')
        ->assertNotPresent($editor)
        ->assertSeeIn($rename, 'Delivery');

    $alicePage->assertSeeIn($rename, 'Delivery')
        ->assertDontSee('Pipeline');

    expect($lead->fresh()->group_name)->toBe('Delivery');
})->with(['voting', 'discussing']);

it('shows the group name above the card in focus while everyone follows', function () {
    [$retro, $columns, $alice, , , $bobParticipant] = resultsBoard(RetroPhase::Discussing, ['presentation_mode' => true]);
    $lead = resultsCard($retro, $columns[0], $bobParticipant, 'Slow CI', ['group_name' => 'Pipeline']);
    resultsCard($retro, $columns[0], $bobParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);
    $focus = '[data-slot="retro-topic-focus"]';
    $firstLines = '[...document.querySelectorAll(\'[data-slot="retro-topic-focus"] [data-slot="card-group-title"], [data-slot="retro-topic-focus"] [data-slot="retro-card-text"]\')].slice(0, 2).map((line) => line.textContent).join(" > ")';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertNotPresent('[data-slot="retro-topic-follow"]');

    $alicePage->click("#card-{$lead->id} button:has-text(\"Discuss\")");

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertPresent('[data-slot="retro-topic-follow"]')
            ->assertScript($firstLines, 'Pipeline > Slow CI')
            ->assertSeeIn($focus, 'Flaky tests');
    }

    expect($retro->fresh()->highlighted_card_id)->toBe($lead->id);
});

it('counts who has voted live during the ROTI phase, shows no distribution and still takes a rating on a locked board', function () {
    [$retro, , $alice] = resultsBoard(RetroPhase::Roti);
    $control = '[role="group"][aria-label="Was this time together worth it?"]';
    $rate = fn (int $rating): string => "{$control} button[data-rating=\"{$rating}\"]";
    $count = '[data-slot="retro-roti-count"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertPresent($control)
            ->assertSeeIn($count, '0/2');
    }

    $carolPage->click($rate(4))
        ->assertAriaAttribute($rate(4), 'pressed', 'true')
        ->assertSeeIn($count, '1/2');

    $alicePage->assertSeeIn($count, '1/2')
        ->assertNotPresent("{$control} button[aria-pressed=\"true\"]");

    $alicePage->click($rate(5))
        ->assertAriaAttribute($rate(5), 'pressed', 'true')
        ->assertSeeIn($count, '2/2');

    $carolPage->assertSeeIn($count, '2/2')
        ->assertAriaAttribute($rate(4), 'pressed', 'true')
        ->assertAriaAttribute($rate(5), 'pressed', 'false');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertDontSee('Average:')
            ->assertNotPresent(sectionTitled('Return on time invested'))
            ->assertPresent('[role="img"][aria-label="Distribution hidden"]')
            ->assertNotPresent('svg[aria-label="Team health radar"]');
    }

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertVisible('#retro-locked')
        ->click('#retro-locked')
        ->assertAriaAttribute('#retro-locked', 'checked', 'true')
        ->click('[role="dialog"] button:has-text("Apply")')
        ->assertSeeIn('[role="dialog"]', 'No changes')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Board closed for editing');

    $carolPage->assertSee('Board closed for editing')
        ->click($rate(3))
        ->assertAriaAttribute($rate(3), 'pressed', 'true')
        ->assertAriaAttribute($rate(4), 'pressed', 'false')
        ->assertSeeIn($count, '2/2');

    expect(RotiVote::query()->where('retro_id', $retro->id)->orderBy('score')->pluck('score')->all())->toBe([3, 5]);

    $carolPage->click($rate(3))
        ->assertAriaAttribute($rate(3), 'pressed', 'false')
        ->assertSeeIn($count, '1/2');

    $alicePage->assertSeeIn($count, '1/2');

    expect($retro->fresh()->is_locked)->toBeTrue()
        ->and(RotiVote::query()->where('retro_id', $retro->id)->pluck('score')->all())->toBe([5]);
});

it('lands a member and a guest on the Results tab when the retro is completed', function () {
    [$retro, , $alice] = resultsBoard();
    $participants = resultsInSection('Thanks for participating', '[...section.querySelectorAll("li")].map((person) => [...person.querySelectorAll(":scope > span:not([data-slot=\\"person-avatar\\"])")].map((part) => part.textContent).join(" ")).sort().join(" | ")');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertNotPresent('#completed-tab-results');

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Completed')
            ->assertAriaAttribute('#completed-tab-results', 'selected', 'true')
            ->assertAriaAttribute('#completed-tab-board', 'selected', 'false')
            ->assertSee('Session ended')
            ->assertScript($participants, 'Alice Martin | Bob Stone | Carol Guest Guest')
            ->assertPresent(sectionTitled('Top topics'))
            ->assertPresent(sectionTitled('Actions created'))
            ->assertPresent(sectionTitled('Return on time invested'))
            ->assertNotPresent('[data-test^="retro-column-"]');
    }

    $alicePage->assertSee('Reopen');
    $carolPage->assertDontSee('Reopen');

    expect($retro->fresh()->phase)->toBe(RetroPhase::Completed);
});

it('exposes the team health radar, figures and trend to a member and no trend to a guest', function () {
    $team = Team::factory()->create();
    $first = resultsPastRetro($team, 'Sprint 10', now()->subWeeks(4), ['vision' => 3, 'motivation' => 3]);
    resolve(ManageTeamHealthStatements::class)->archive($team, 'motivation');
    $second = resultsPastRetro($team, 'Sprint 11', now()->subWeeks(2), ['vision' => 3, 'interaction' => 3]);
    [$retro, , , $bob, $aliceParticipant, $bobParticipant] = resultsBoard(RetroPhase::Completed, [], $team);
    answerHealthCheck($retro, $aliceParticipant, ['interaction' => 4, 'task_clarity' => 3, 'manager_support' => 5, 'vision' => 2]);
    answerHealthCheck($retro, $bobParticipant, ['interaction' => 4, 'task_clarity' => 3, 'manager_support' => 5, 'vision' => 2]);
    closeHealthCheck($retro);
    $compact = '[data-slot="health-check-compact"]';
    $details = '[role="dialog"] [data-slot="health-check-results"]';
    $rows = "[...document.querySelectorAll('[data-slot=\"health-compact-row\"]')].map((row) => row.textContent).join(' | ')";
    $figures = "[...document.querySelectorAll('[role=\"dialog\"] [data-slot=\"health-summary\"] > div')].map((figure) => [...figure.children].map((part) => part.textContent).join(' ')).join(' | ')";
    $trend = fn (string $expression): string => "(() => { const svg = document.querySelector('svg[aria-label=\"Trend across retros\"]'); return {$expression}; })()";

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertScript($rows, 'Interaction4.0+1.0 vs Sprint 11 | Clear tasks3.0 | Manager support5.0 | Vision · Needs attention2.0−1.0 vs Sprint 11 | ProcessesNo answers');
    $carolPage->assertScript($rows, 'Interaction4.0 | Clear tasks3.0 | Manager support5.0 | Vision · Needs attention2.0 | ProcessesNo answers');

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertSeeIn($compact, '2 answers · avg 3.5')
            ->assertNotPresent('svg[aria-label="Team health radar"]');

        resultsOpenHealthDetails($page)
            ->assertPresent('svg[aria-label="Team health radar"]')
            ->assertScript(resultsRadar('svg.querySelector("desc").textContent'), 'Interaction: 4.0/5; Clear tasks: 3.0/5; Manager support: 5.0/5; Vision: 2.0/5; Processes: No answers')
            ->assertScript(resultsRadar('[...svg.querySelectorAll("text")].map((label) => label.firstChild.textContent).join(", ")'), 'Interaction, Clear tasks, Manager support, Vision, Processes')
            ->assertScript(resultsRadar('[...svg.querySelectorAll("tspan")].map((gap) => gap.textContent).join(", ")'), 'No answers')
            ->assertScript(resultsRadar('svg.querySelectorAll("circle").length'), 4)
            ->assertScript(resultsRadar('svg.querySelectorAll("line.stroke-primary").length'), 3)
            ->assertScript(resultsRadar('svg.querySelectorAll("polygon.stroke-primary").length'), 0)
            ->assertScript($figures, 'Score 3.5/5 | Top strength Manager support 5.0/5 | Growth area Vision 2.0/5 | Alignment 10/10 High team consensus')
            ->assertSeeIn($details, '2 answers from 3 participants')
            ->assertSeeIn("{$details} [data-slot=\"health-assessment\"]", 'Good')
            ->assertSeeIn("{$details} [data-statement-key=\"task_clarity\"]", '3.0/5')
            ->assertSeeIn("{$details} [data-statement-key=\"processes\"]", 'No answers');
    }

    $bobPage->assertSeeIn('[role="dialog"]', 'Trend across retros')
        ->assertScript($trend('[...svg.querySelectorAll("circle title")].map((point) => point.textContent).join(" | ")'), 'Sprint 10: 3.0/5 | Sprint 11: 3.0/5 — The statements changed since the previous retro | Sprint 12: 3.5/5')
        ->assertScript($trend('[...svg.querySelectorAll("circle")].map((point) => point.classList.contains("fill-background")).join(",")'), 'false,true,false')
        ->assertScript($trend('[...svg.querySelectorAll("a")].map((link) => link.getAttribute("href").split("/retros/")[1]).join(",")'), "{$first->id},{$second->id},{$retro->id}")
        ->assertScript($trend('svg.querySelector("polyline").getAttribute("points").split(" ").length'), 3)
        ->assertSeeIn('[role="dialog"]', '+0.5 since the previous retro');

    $carolPage->assertNotPresent('svg[aria-label="Trend across retros"]')
        ->assertDontSeeIn('[role="dialog"]', 'Trend across retros')
        ->assertDontSeeIn('[role="dialog"]', 'since the previous retro')
        ->assertScript('document.documentElement.outerHTML.includes("Sprint 11")', false);
});

it('shows every survey with bars, percentages, voters, text answers, reactions and read-only comments', function () {
    [$retro, , , $bob, $aliceParticipant, $bobParticipant] = resultsBoard(RetroPhase::Completed);
    $choice = Survey::factory()->closed()->withOptions(['Great', 'Fine', 'Rough'])->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $aliceParticipant->id,
        'question' => 'How was the sprint?',
        'show_voters' => true,
        'position' => 0,
    ]);
    $freeText = Survey::factory()->text()->closed()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $aliceParticipant->id,
        'question' => 'What should we try next?',
        'show_voters' => true,
        'position' => 1,
    ]);
    answerSurvey($choice, $aliceParticipant, 0);
    answerSurvey($choice, $bobParticipant, 0);
    SurveyTextAnswer::factory()->create(['survey_id' => $freeText->id, 'participant_id' => $bobParticipant->id, 'content' => 'Shorter standups']);
    SurveyReaction::factory()->create(['retro_id' => $retro->id, 'survey_id' => $choice->id, 'participant_id' => $aliceParticipant->id, 'emoji' => '👍']);
    SurveyComment::factory()->create(['retro_id' => $retro->id, 'survey_id' => $choice->id, 'participant_id' => $aliceParticipant->id, 'content' => 'Pairing saved us']);
    $surveys = sectionTitled('Surveys');
    $single = 'article[aria-label="How was the sprint?"]';
    $text = 'article[aria-label="What should we try next?"]';
    $great = "{$single} li:has-text(\"Great\")";
    $fine = "{$single} li:has-text(\"Fine\")";
    $barWidths = "[...document.querySelectorAll('{$single} li [data-slot=\"survey-result-bar\"] > div')].map((bar) => bar.style.width).join(',')";

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertCount("{$surveys} article", 2)
            ->assertSeeIn($great, '2 · 100%')
            ->assertSeeIn($fine, '0 · 0%')
            ->assertScript($barWidths, '100%,0%,0%')
            ->assertPresent("{$great} img[alt=\"Alice Martin\"]")
            ->assertPresent("{$great} img[alt=\"Bob Stone\"]")
            ->assertNotPresent("{$fine} img")
            ->assertSeeIn($single, '2 responses')
            ->assertSeeIn("{$text} ul[aria-label=\"Answers\"] li", 'Shorter standups')
            ->assertSeeIn("{$text} ul[aria-label=\"Answers\"] li", 'Bob Stone')
            ->assertSeeIn($text, '1 response')
            ->assertDisabled("{$single} [aria-label=\"👍, 1 reaction\"]")
            ->assertNotPresent('[aria-label="Add a reaction"]')
            ->assertNotPresent('[aria-label="Survey actions"]')
            ->assertDontSeeIn($single, 'Pairing saved us')
            ->click("{$single} button[aria-label=\"Comments (1)\"]")
            ->assertSeeIn($single, 'Pairing saved us')
            ->assertSeeIn($single, 'Alice Martin')
            ->assertNotPresent('[aria-label="Write a comment…"]');
    }
});

it('lists the top topics with their group name and grouped count, and the action items', function () {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = resultsBoard(RetroPhase::Completed);
    $lead = resultsCard($retro, $columns[0], $aliceParticipant, 'Slow CI', ['group_name' => 'Pipeline']);
    resultsCard($retro, $columns[0], $aliceParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);
    resultsCard($retro, $columns[0], $aliceParticipant, 'Manual releases', ['parent_card_id' => $lead->id, 'position' => 1]);
    $single = resultsCard($retro, $columns[1], $bobParticipant, 'Too many meetings');
    resultsCard($retro, $columns[1], $bobParticipant, 'Nobody reads the wiki', ['position' => 1]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $lead->id, 'participant_id' => $bobParticipant->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $single->id, 'participant_id' => $aliceParticipant->id]);
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Buy a faster runner',
        'created_by_participant_id' => $aliceParticipant->id,
    ]);
    $topics = resultsInSection('Top topics', '[...section.querySelectorAll("ol > li")].map((topic) => [...topic.querySelectorAll("p, span")].map((part) => part.textContent).join(" / ")).join(" | ")');

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertScript($topics, 'Pipeline / Slow CI / 2 grouped cards / 3 | Too many meetings / 1 | Nobody reads the wiki / 0')
            ->assertSeeIn(sectionTitled('Actions created'), 'Buy a faster runner')
            ->assertNotPresent('[aria-label="Add an action item…"]')
            ->assertNotPresent('[aria-label="Rename group"]');
    }
});

it('shows the ROTI average, distribution and respondent count in the Results view', function () {
    [$retro, , , $bob, $aliceParticipant, $bobParticipant] = resultsBoard(RetroPhase::Completed);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $aliceParticipant->id, 'score' => 4]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $bobParticipant->id, 'score' => 5]);
    $roti = sectionTitled('Return on time invested');
    $control = '[role="group"][aria-label="Was this time together worth it?"]';
    $rows = resultsInSection('Return on time invested', '[...section.querySelectorAll("li[data-rating]")].map((row) => row.dataset.rating + " · " + row.children[1].textContent + " = " + row.lastElementChild.textContent).join(" | ")');
    $bars = resultsInSection('Return on time invested', '[...section.querySelectorAll("li[data-rating] > span[aria-hidden] > span")].map((bar) => bar.style.width).join(",")');

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertSeeIn("{$roti} [data-slot=\"roti-mean\"]", '4.5')
            ->assertSeeIn($roti, '2 votes')
            ->assertScript($rows, '5 · Excellent = 1 | 4 · Useful = 1 | 3 · OK = 0 | 2 · Not very useful = 0 | 1 · Waste of time = 0')
            ->assertScript($bars, '100%,100%,0%,0%,0%')
            ->assertNotPresent($control);
    }
});

it('switches between the Results and Board tabs and selects Results again after a reopen and a new completion', function () {
    [$retro, $columns, $alice, , $aliceParticipant] = resultsBoard(RetroPhase::Completed);
    $card = resultsCard($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $thanks = sectionTitled('Thanks for participating');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertAriaAttribute('#completed-tab-results', 'selected', 'true')
        ->assertPresent($thanks)
        ->click('#completed-tab-board')
        ->assertAriaAttribute('#completed-tab-board', 'selected', 'true')
        ->assertPresent("#card-{$card->id}")
        ->assertNotPresent($thanks)
        ->click('#completed-tab-results')
        ->assertAriaAttribute('#completed-tab-results', 'selected', 'true')
        ->assertPresent($thanks)
        ->assertNotPresent("#card-{$card->id}");

    foreach ([$alicePage, $carolPage] as $page) {
        $page->click('#completed-tab-board')
            ->assertAriaAttribute('#completed-tab-board', 'selected', 'true')
            ->assertPresent("#card-{$card->id}");
    }

    $alicePage->press('Reopen')
        ->assertSeeIn('[aria-current="step"]', 'ROTI');

    $carolPage->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->assertNotPresent('#completed-tab-results');

    $alicePage->press('Previous')
        ->assertSeeIn('[aria-current="step"]', 'Actions');

    $carolPage->assertSeeIn('[aria-current="step"]', 'Actions')
        ->assertPresent('[aria-label="Add an action item…"]');

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Completed')
            ->assertAriaAttribute('#completed-tab-results', 'selected', 'true')
            ->assertPresent($thanks)
            ->assertNotPresent("#card-{$card->id}");
    }

    expect($retro->fresh()->phase)->toBe(RetroPhase::Completed);
});

it('keeps the result bars and the charts still, with or without a preference for reduced motion', function () {
    [$retro, , , , $aliceParticipant] = resultsBoard(RetroPhase::Completed);
    answerHealthCheck($retro, $aliceParticipant, ['vision' => 4, 'interaction' => 3]);
    closeHealthCheck($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $aliceParticipant->id, 'score' => 4]);
    $joinPath = "/join/{$retro->guest_token}";
    $prefersReducedMotion = 'window.matchMedia("(prefers-reduced-motion: reduce)").matches';
    $barsAreStill = resultsInSection('Return on time invested', '[...section.querySelectorAll("[data-slot=\\"roti-stack\\"] span, li[data-rating] span")].every((bar) => getComputedStyle(bar).animationName === "none" && ["0s", "0.001s"].includes(getComputedStyle(bar).transitionDuration))');
    $barsAreStrictlyStill = resultsInSection('Return on time invested', '[...section.querySelectorAll("[data-slot=\\"roti-stack\\"] span, li[data-rating] span")].every((bar) => getComputedStyle(bar).animationName === "none" && getComputedStyle(bar).transitionDuration === "0s")');
    $chartIsStill = resultsRadar('[...svg.querySelectorAll("polygon, line, circle")].every((shape) => getComputedStyle(shape).animationName === "none" && getComputedStyle(shape).transitionDuration === "0s")');
    $chartIsStillWithAtMostOneMillisecond = resultsRadar('[...svg.querySelectorAll("polygon, line, circle")].every((shape) => getComputedStyle(shape).animationName === "none" && ["0s", "0.001s"].includes(getComputedStyle(shape).transitionDuration))');
    $animationElements = 'document.querySelectorAll("svg animate, svg animateTransform, svg animateMotion, svg set").length';

    $reducedPage = visit($joinPath, ['reducedMotion' => 'reduce']);

    $reducedPage->fill('#name', 'Carol Guest')
        ->click('Join the session')
        ->assertPathIsNot($joinPath);

    $reducedPage->assertPresent(sectionTitled('Return on time invested'));

    resultsOpenHealthDetails($reducedPage)
        ->assertPresent('svg[aria-label="Team health radar"]')
        ->assertScript($prefersReducedMotion, true)
        ->assertScript($barsAreStill, true)
        ->assertScript($chartIsStillWithAtMostOneMillisecond, true)
        ->assertScript($animationElements, 0);

    $defaultPage = $this->joinAsGuest($joinPath, 'Dave Guest');

    $defaultPage->assertPresent(sectionTitled('Return on time invested'));

    resultsOpenHealthDetails($defaultPage)
        ->assertScript($prefersReducedMotion, false)
        ->assertScript($barsAreStrictlyStill, true)
        ->assertScript($chartIsStill, true)
        ->assertScript($animationElements, 0);
});
