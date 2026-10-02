<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\HealthCheckAnswer;
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
function p08dBoard(RetroPhase $phase = RetroPhase::Discussing, array $attributes = [], ?Team $team = null): array
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
function p08dCard(Retro $retro, Column $column, Participant $author, string $content, array $attributes = []): Card
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

function p08dSection(string $title): string
{
    return "section:has(h2:has-text(\"{$title}\"))";
}

function p08dInSection(string $title, string $expression): string
{
    return "(() => { const section = [...document.querySelectorAll('section')].find((candidate) => candidate.querySelector('h2')?.textContent === '{$title}'); return {$expression}; })()";
}

/**
 * @param  array<string, int>  $scores
 */
function p08dHealthAnswers(Retro $retro, Participant $participant, array $scores): void
{
    foreach ($scores as $statement => $score) {
        HealthCheckAnswer::factory()->create([
            'retro_id' => $retro->id,
            'participant_id' => $participant->id,
            'statement' => $statement,
            'score' => $score,
        ]);
    }
}

/**
 * @param  array<string, int>  $scores
 */
function p08dPastRetro(Team $team, string $title, CarbonInterface $completedAt, array $scores): Retro
{
    $retro = Retro::factory()
        ->withHealthCheck()
        ->inPhase(RetroPhase::Completed)
        ->create(['team_id' => $team->id, 'title' => $title, 'completed_at' => $completedAt]);

    resolve(FreezeHealthStatements::class)->handle($retro);

    p08dHealthAnswers($retro, Participant::factory()->create(['retro_id' => $retro->id]), $scores);

    return $retro;
}

function p08dRadar(string $expression): string
{
    return "(() => { const svg = document.querySelector('svg[aria-label=\"Team health radar\"]'); return {$expression}; })()";
}

it('[P08d-01a] shows a group name typed by a guest to the member without reloading', function () {
    [$retro, $columns, $alice, , , $bobParticipant] = p08dBoard(RetroPhase::Grouping);
    $lead = p08dCard($retro, $columns[0], $bobParticipant, 'Slow CI');
    p08dCard($retro, $columns[0], $bobParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);
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

it('[P08d-01b] drops the group name in both browsers when the only grouped card leaves the group', function () {
    [$retro, $columns, $alice, , , $bobParticipant] = p08dBoard(RetroPhase::Grouping);
    $lead = p08dCard($retro, $columns[0], $bobParticipant, 'Slow CI', ['group_name' => 'Pipeline']);
    $child = p08dCard($retro, $columns[0], $bobParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);

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

it('[P08d-01c] keeps only the target name when a named group is grouped onto another named group', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = p08dBoard(RetroPhase::Grouping);
    $quality = p08dCard($retro, $columns[0], $bobParticipant, 'Missing tests', ['group_name' => 'Quality', 'position' => 0]);
    $deploys = p08dCard($retro, $columns[0], $bobParticipant, 'Slow CI', ['group_name' => 'Deploys', 'position' => 1]);
    $deploysChild = p08dCard($retro, $columns[0], $bobParticipant, 'Manual releases', ['parent_card_id' => $deploys->id]);
    p08dCard($retro, $columns[0], $bobParticipant, 'No code review', ['parent_card_id' => $quality->id]);
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

it('[P08d-02a] renames a group inline for everyone', function (string $phase) {
    [$retro, $columns, $alice, , , $bobParticipant] = p08dBoard(RetroPhase::from($phase));
    $lead = p08dCard($retro, $columns[0], $bobParticipant, 'Slow CI', ['group_name' => 'Pipeline']);
    p08dCard($retro, $columns[0], $bobParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);
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

it('[P08d-02b] shows the group name above the card in presentation mode', function () {
    [$retro, $columns, $alice, , , $bobParticipant] = p08dBoard(RetroPhase::Discussing, ['presentation_mode' => true]);
    $lead = p08dCard($retro, $columns[0], $bobParticipant, 'Slow CI', ['group_name' => 'Pipeline']);
    p08dCard($retro, $columns[0], $bobParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);
    $firstLines = '[...document.querySelectorAll(\'[role="dialog"] p\')].slice(0, 2).map((line) => line.textContent).join(" > ")';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertNotPresent('[role="dialog"]');

    $alicePage->click("#card-{$lead->id} button:has-text(\"Discuss\")");

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertPresent('[role="dialog"]')
            ->assertScript($firstLines, 'Pipeline > Slow CI')
            ->assertSeeIn('[role="dialog"]', 'Flaky tests');
    }

    expect($retro->fresh()->highlighted_card_id)->toBe($lead->id);
});

it('[P08d-03] counts the ratings live during Discussing, shows no distribution and still takes a rating on a locked board', function () {
    [$retro, , $alice] = p08dBoard();
    $control = '[role="group"][aria-label="How was this retro?"]';
    $rate = fn (string $label): string => "{$control} button:has-text(\"{$label}\")";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertPresent($control)
            ->assertSee('0 ratings');
    }

    $carolPage->click($rate('Good use of time'))
        ->assertAriaAttribute($rate('Good use of time'), 'pressed', 'true')
        ->assertSee('1 rating');

    $alicePage->assertSee('1 rating')
        ->assertNotPresent("{$control} button[aria-pressed=\"true\"]");

    $alicePage->click($rate('Excellent use of time'))
        ->assertAriaAttribute($rate('Excellent use of time'), 'pressed', 'true')
        ->assertSee('2 ratings');

    $carolPage->assertSee('2 ratings')
        ->assertAriaAttribute($rate('Excellent use of time'), 'pressed', 'false');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertDontSee('Average:')
            ->assertDontSee('Return on time invested')
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
        ->click($rate('Break-even'))
        ->assertAriaAttribute($rate('Break-even'), 'pressed', 'true')
        ->assertAriaAttribute($rate('Good use of time'), 'pressed', 'false')
        ->assertSee('2 ratings');

    expect(RotiVote::query()->where('retro_id', $retro->id)->orderBy('score')->pluck('score')->all())->toBe([3, 5]);

    $carolPage->click($rate('Break-even'))
        ->assertAriaAttribute($rate('Break-even'), 'pressed', 'false')
        ->assertSee('1 rating');

    $alicePage->assertSee('1 rating');

    expect($retro->fresh()->is_locked)->toBeTrue()
        ->and(RotiVote::query()->where('retro_id', $retro->id)->pluck('score')->all())->toBe([5]);
});

it('[P08d-04a] lands a member and a guest on the Results tab when the retro is completed', function () {
    [$retro, , $alice] = p08dBoard();
    $participants = p08dInSection('Thanks for participating', '[...section.querySelectorAll("li")].map((person) => [...person.querySelectorAll("span")].map((part) => part.textContent).join(" ")).sort().join(" | ")');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertNotPresent('#completed-tab-results');

    $alicePage->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Completed')
            ->assertAriaAttribute('#completed-tab-results', 'selected', 'true')
            ->assertAriaAttribute('#completed-tab-board', 'selected', 'false')
            ->assertSee('Retrospective completed on')
            ->assertScript($participants, 'Alice Martin | Bob Stone | Carol Guest Guest')
            ->assertPresent(p08dSection('Top topics'))
            ->assertPresent(p08dSection('Action items'))
            ->assertPresent(p08dSection('Return on time invested'))
            ->assertNotPresent('[data-test^="retro-column-"]');
    }

    $alicePage->assertSee('Reopen');
    $carolPage->assertDontSee('Reopen');

    expect($retro->fresh()->phase)->toBe(RetroPhase::Completed);
});

it('[P08d-04b] exposes the team health radar, figures and trend to a member and no trend to a guest', function () {
    $team = Team::factory()->create();
    $first = p08dPastRetro($team, 'Sprint 10', now()->subWeeks(4), ['vision' => 6, 'motivation' => 6]);
    resolve(ManageTeamHealthStatements::class)->archive($team, 'motivation');
    $second = p08dPastRetro($team, 'Sprint 11', now()->subWeeks(2), ['vision' => 6, 'interaction' => 7]);
    [$retro, , , $bob, $aliceParticipant, $bobParticipant] = p08dBoard(RetroPhase::Completed, ['health_check_enabled' => true], $team);
    resolve(FreezeHealthStatements::class)->handle($retro);
    p08dHealthAnswers($retro, $aliceParticipant, ['interaction' => 8, 'task_clarity' => 6, 'manager_support' => 9, 'vision' => 4]);
    p08dHealthAnswers($retro, $bobParticipant, ['interaction' => 8, 'task_clarity' => 8, 'manager_support' => 9, 'vision' => 4]);
    $health = p08dSection('Team health');
    $figures = p08dInSection('Team health', '[...section.querySelectorAll("dl > div")].map((figure) => [...figure.children].map((part) => part.textContent).join(" ")).join(" | ")');
    $trend = fn (string $expression): string => "(() => { const svg = document.querySelector('svg[aria-label=\"Trend across retros\"]'); return {$expression}; })()";

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertPresent('svg[aria-label="Team health radar"]')
            ->assertScript(p08dRadar('svg.querySelector("desc").textContent'), 'Interaction: 8.0/10; Clear tasks: 7.0/10; Manager support: 9.0/10; Vision: 4.0/10; Processes: No answers')
            ->assertScript(p08dRadar('[...svg.querySelectorAll("text")].map((label) => label.firstChild.textContent).join(", ")'), 'Interaction, Clear tasks, Manager support, Vision, Processes')
            ->assertScript(p08dRadar('[...svg.querySelectorAll("tspan")].map((gap) => gap.textContent).join(", ")'), 'No answers')
            ->assertScript(p08dRadar('svg.querySelectorAll("circle").length'), 4)
            ->assertScript(p08dRadar('svg.querySelectorAll("line.stroke-primary").length'), 3)
            ->assertScript(p08dRadar('svg.querySelectorAll("polygon.stroke-primary").length'), 0)
            ->assertScript($figures, 'Score 7.0/10 | Participation 2 / 3 participants | Top strength Manager support 9.0/10 | Growth area Vision 4.0/10 | Alignment 9/10 High team consensus')
            ->assertSeeIn($health, 'Good')
            ->assertSeeIn($health, 'Most health scores are above average. Keep the momentum going.')
            ->assertSeeIn("{$health} li:has-text(\"Tasks assigned to me were clear\")", '7.0/10')
            ->assertSeeIn("{$health} li:has-text(\"Our processes let me work without blockers\")", 'No answers');
    }

    $bobPage->assertSeeIn($health, 'Trend across retros')
        ->assertScript($trend('[...svg.querySelectorAll("circle title")].map((point) => point.textContent).join(" | ")'), 'Sprint 10: 6.0/10 | Sprint 11: 6.5/10 — The statements changed since the previous retro | Sprint 12: 7.0/10')
        ->assertScript($trend('[...svg.querySelectorAll("circle")].map((point) => point.classList.contains("fill-background")).join(",")'), 'false,true,false')
        ->assertScript($trend('[...svg.querySelectorAll("a")].map((link) => link.getAttribute("href").split("/retros/")[1]).join(",")'), "{$first->id},{$second->id},{$retro->id}")
        ->assertScript($trend('svg.querySelector("polyline").getAttribute("points").split(" ").length'), 3)
        ->assertSeeIn($health, '+0.5 since the previous retro');

    $carolPage->assertNotPresent('svg[aria-label="Trend across retros"]')
        ->assertDontSeeIn($health, 'Trend across retros')
        ->assertDontSeeIn($health, 'since the previous retro')
        ->assertScript('document.documentElement.outerHTML.includes("Sprint 11")', false);
});

it('[P08d-04c] shows every survey with bars, percentages, voters, text answers, reactions and read-only comments', function () {
    [$retro, , , $bob, $aliceParticipant, $bobParticipant] = p08dBoard(RetroPhase::Completed);
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
    $surveys = p08dSection('Surveys');
    $single = 'article[aria-label="How was the sprint?"]';
    $text = 'article[aria-label="What should we try next?"]';
    $great = "{$single} li:has-text(\"Great\")";
    $fine = "{$single} li:has-text(\"Fine\")";
    $barWidths = "[...document.querySelectorAll('{$single} li div.bg-primary')].map((bar) => bar.style.width).join(',')";

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertCount("{$surveys} article", 2)
            ->assertSeeIn($great, '100% · 2')
            ->assertSeeIn($fine, '0% · 0')
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

it('[P08d-04d] lists the top topics with their group name and grouped count, and the action items', function () {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = p08dBoard(RetroPhase::Completed);
    $lead = p08dCard($retro, $columns[0], $aliceParticipant, 'Slow CI', ['group_name' => 'Pipeline']);
    p08dCard($retro, $columns[0], $aliceParticipant, 'Flaky tests', ['parent_card_id' => $lead->id]);
    p08dCard($retro, $columns[0], $aliceParticipant, 'Manual releases', ['parent_card_id' => $lead->id, 'position' => 1]);
    $single = p08dCard($retro, $columns[1], $bobParticipant, 'Too many meetings');
    p08dCard($retro, $columns[1], $bobParticipant, 'Nobody reads the wiki', ['position' => 1]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $lead->id, 'participant_id' => $bobParticipant->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $single->id, 'participant_id' => $aliceParticipant->id]);
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Buy a faster runner',
        'created_by_participant_id' => $aliceParticipant->id,
    ]);
    $topics = p08dInSection('Top topics', '[...section.querySelectorAll("ol > li")].map((topic) => [...topic.querySelectorAll("p, span")].map((part) => part.textContent).join(" / ")).join(" | ")');

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertScript($topics, 'Pipeline / Slow CI / 2 grouped cards / 3 | Too many meetings / 1 | Nobody reads the wiki / 0')
            ->assertSeeIn(p08dSection('Action items'), 'Buy a faster runner')
            ->assertNotPresent('[aria-label="Add an action item…"]')
            ->assertNotPresent('[aria-label="Rename group"]');
    }
});

it('[P08d-04e] shows the ROTI average, distribution and respondent count in the Results view', function () {
    [$retro, , , $bob, $aliceParticipant, $bobParticipant] = p08dBoard(RetroPhase::Completed);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $aliceParticipant->id, 'score' => 4]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $bobParticipant->id, 'score' => 5]);
    $roti = p08dSection('Return on time invested');
    $control = '[role="group"][aria-label="How was this retro?"]';
    $rows = p08dInSection('Return on time invested', '[...section.querySelectorAll("ul li")].map((row) => row.firstElementChild.textContent + " = " + row.lastElementChild.textContent).join(" | ")');
    $bars = p08dInSection('Return on time invested', '[...section.querySelectorAll("ul li div > div")].map((bar) => bar.style.width).join(",")');

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertSeeIn($roti, 'Average: 4.5/5')
            ->assertSeeIn($roti, '2 ratings')
            ->assertScript($rows, '1 · Time wasted = 0 | 2 · Not really worth it = 0 | 3 · Break-even = 0 | 4 · Good use of time = 1 | 5 · Excellent use of time = 1')
            ->assertScript($bars, '0%,0%,0%,100%,100%');
    }

    $bobPage->assertAriaAttribute("{$control} button:has-text(\"Excellent use of time\")", 'pressed', 'true');
    $carolPage->assertNotPresent("{$control} button[aria-pressed=\"true\"]");
});

it('[P08d-05a] refreshes the Results view of the other browser when a rating is given or changed', function () {
    [$retro, , $alice] = p08dBoard(RetroPhase::Completed);
    $roti = p08dSection('Return on time invested');
    $control = '[role="group"][aria-label="How was this retro?"]';
    $rate = fn (string $label): string => "{$control} button:has-text(\"{$label}\")";
    $counts = p08dInSection('Return on time invested', '[...section.querySelectorAll("ul li")].map((row) => row.lastElementChild.textContent).join(",")');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($roti, 'No ratings yet.')
            ->assertSeeIn($roti, '0 ratings');
    }

    $carolPage->click($rate('Good use of time'))
        ->assertAriaAttribute($rate('Good use of time'), 'pressed', 'true')
        ->assertSeeIn($roti, 'Average: 4.0/5')
        ->assertScript($counts, '0,0,0,1,0');

    $alicePage->assertSeeIn($roti, 'Average: 4.0/5')
        ->assertSeeIn($roti, '1 rating')
        ->assertScript($counts, '0,0,0,1,0')
        ->assertNotPresent("{$control} button[aria-pressed=\"true\"]");

    $carolPage->click($rate('Not really worth it'))
        ->assertAriaAttribute($rate('Not really worth it'), 'pressed', 'true')
        ->assertSeeIn($roti, 'Average: 2.0/5');

    $alicePage->assertSeeIn($roti, 'Average: 2.0/5')
        ->assertSeeIn($roti, '1 rating')
        ->assertScript($counts, '0,1,0,0,0');

    expect(RotiVote::query()->where('retro_id', $retro->id)->pluck('score')->all())->toBe([2]);
});

it('[P08d-05b] switches between the Results and Board tabs and selects Results again after a reopen and a new completion', function () {
    [$retro, $columns, $alice, , $aliceParticipant] = p08dBoard(RetroPhase::Completed);
    $card = p08dCard($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $thanks = p08dSection('Thanks for participating');

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
        ->assertSeeIn('[aria-current="step"]', 'Discussing');

    $carolPage->assertSeeIn('[aria-current="step"]', 'Discussing')
        ->assertNotPresent('#completed-tab-results')
        ->assertPresent('[aria-label="Add an action item…"]');

    $alicePage->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Completed')
            ->assertAriaAttribute('#completed-tab-results', 'selected', 'true')
            ->assertPresent($thanks)
            ->assertNotPresent("#card-{$card->id}");
    }

    expect($retro->fresh()->phase)->toBe(RetroPhase::Completed);
});

it('[P08d-06] gives the result bars no transition and the charts no animation when the viewer prefers reduced motion', function () {
    [$retro, , , , $aliceParticipant] = p08dBoard(RetroPhase::Completed, ['health_check_enabled' => true]);
    resolve(FreezeHealthStatements::class)->handle($retro);
    p08dHealthAnswers($retro, $aliceParticipant, ['vision' => 8, 'interaction' => 6]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $aliceParticipant->id, 'score' => 4]);
    $joinPath = "/join/{$retro->guest_token}";
    $prefersReducedMotion = 'window.matchMedia("(prefers-reduced-motion: reduce)").matches';
    $barTransition = p08dInSection('Return on time invested', 'getComputedStyle(section.querySelector("ul li div > div")).transitionDuration');
    $barHasTransition = p08dInSection('Return on time invested', 'getComputedStyle(section.querySelector("ul li div > div")).transitionDuration !== "0s"');
    $chartIsStill = p08dRadar('[...svg.querySelectorAll("polygon, line, circle")].every((shape) => getComputedStyle(shape).animationName === "none" && getComputedStyle(shape).transitionDuration === "0s")');
    $chartIsStillWithAtMostOneMillisecond = p08dRadar('[...svg.querySelectorAll("polygon, line, circle")].every((shape) => getComputedStyle(shape).animationName === "none" && ["0s", "0.001s"].includes(getComputedStyle(shape).transitionDuration))');
    $animationElements = 'document.querySelectorAll("svg animate, svg animateTransform, svg animateMotion, svg set").length';

    $reducedPage = visit($joinPath, ['reducedMotion' => 'reduce']);

    $reducedPage->fill('#name', 'Carol Guest')
        ->click('Join')
        ->assertPathIsNot($joinPath);

    $reducedPage->assertSee('Return on time invested')
        ->assertPresent('svg[aria-label="Team health radar"]')
        ->assertScript($prefersReducedMotion, true)
        ->assertScript($barTransition, '0.001s')
        ->assertScript($chartIsStillWithAtMostOneMillisecond, true)
        ->assertScript($animationElements, 0);

    $defaultPage = $this->joinAsGuest($joinPath, 'Dave Guest');

    $defaultPage->assertSee('Return on time invested')
        ->assertScript($prefersReducedMotion, false)
        ->assertScript($barHasTransition, true)
        ->assertScript($chartIsStill, true)
        ->assertScript($animationElements, 0);
});
