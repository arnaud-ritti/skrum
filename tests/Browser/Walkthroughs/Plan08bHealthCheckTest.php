<?php

use App\Enums\HealthStatement;
use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Enums\WorkspaceRole;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\User;

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
function p08bBoard(array $attributes = [], RetroPhase $phase = RetroPhase::Writing): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withHealthCheck()
        ->withGuestAccess()
        ->create(['title' => 'Sprint 15', ...$attributes]);

    $columns = [];

    foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
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
 * @return array<string, int>
 */
function p08bScores(int $score = 4): array
{
    return array_fill_keys(['interaction', 'task_clarity', 'manager_support', 'vision', 'processes', 'motivation'], $score);
}

function p08bSurvey(Retro $retro): TeamSurvey
{
    return TeamSurvey::query()->where('retro_id', $retro->id)->sole();
}

function p08bButton(): string
{
    return 'button:has([data-slot="health-check-count"])';
}

function p08bDialog(): string
{
    return '[data-slot="retro-health-check-dialog"]';
}

function p08bScore(string $statement, int $score): string
{
    return p08bDialog()." [role=\"radiogroup\"][aria-label=\"{$statement}\"] [aria-label=\"Score {$score}\"]";
}

function p08bChecked(): string
{
    return p08bDialog().' [role="radio"][aria-checked="true"]';
}

function p08bSubmit(): string
{
    return p08bDialog().' button:has-text("Submit answers")';
}

function p08bBuiltInTexts(): array
{
    return [
        'Interaction with colleagues was productive',
        'Tasks assigned to me were clear',
        'My manager was understanding and supportive',
        'The vision and goals are clear to me',
        'Our processes let me work without blockers',
        'I felt motivated in my work',
    ];
}

function p08bBuiltIns(): string
{
    return implode(' | ', p08bBuiltInTexts());
}

function p08bTeamStatements(): string
{
    return "[...[...document.querySelectorAll('section')].find((section) => section.querySelector('h2')?.textContent === 'Health check statements').querySelectorAll('ol > li')].map((row) => row.querySelector('p').textContent).join(' | ')";
}

function p08bTeamSummary(): string
{
    return "[...document.querySelectorAll('[data-slot=\"health-check-summary-statement\"]')].map((row) => row.lastElementChild.textContent).join(' | ')";
}

function p08bDialogStatements(): string
{
    return "[...document.querySelectorAll('[data-slot=\"retro-health-check-dialog\"] [role=\"radiogroup\"]')].map((group) => group.getAttribute('aria-label')).join(' | ')";
}

function p08bOpen(mixed $page): mixed
{
    $page->click(p08bButton())
        ->assertVisible(p08bDialog());

    return $page;
}

/**
 * @param  array<int, int>  $scores  one score per built-in statement, in order
 */
function p08bScoreAll(mixed $page, array $scores): mixed
{
    foreach (p08bBuiltInTexts() as $index => $statement) {
        $page->click(p08bScore($statement, $scores[$index]))
            ->assertAttribute(p08bScore($statement, $scores[$index]), 'aria-checked', 'true');
    }

    return $page;
}

/**
 * @param  array<string, mixed>  $snapshot
 * @return array{
 *     keys: string,
 *     fields: string,
 *     myScores: array<int, ?int>,
 *     respondents: int,
 *     participants: int,
 *     hasSubmitted: bool,
 *     results: mixed,
 *     json: string
 * }
 */
function p08bHealthSnapshot(array $snapshot): array
{
    $healthCheck = $snapshot['healthCheck'];
    $statements = collect($healthCheck['statements']);

    return [
        'keys' => implode(',', array_keys($healthCheck)),
        'fields' => $statements->flatMap(fn (array $statement): array => array_keys($statement))->unique()->sort()->implode(','),
        'myScores' => $statements->pluck('myScore')->all(),
        'respondents' => $healthCheck['respondents'],
        'participants' => $healthCheck['participants'],
        'hasSubmitted' => $healthCheck['hasSubmitted'],
        'results' => $healthCheck['results'],
        'json' => json_encode($healthCheck, JSON_THROW_ON_ERROR),
    ];
}

it('[P08b-01a] lets an Owner add, archive, reorder, reword and restore the health check statements of a team, on the page the team card leads to', function () {
    $team = Team::factory()->create();
    $olivia = workspaceManager($team->workspace, WorkspaceRole::Owner);
    $olivia->update(['name' => 'Olivia Owner', 'locale' => 'en']);
    $active = 'li:has([aria-label="Drag to reorder"])';
    $manager = 'li:has-text("My manager was understanding and supportive")';
    $custom = 'li:has-text("We shipped what we promised")';
    $editing = 'li:has(input[aria-label="Statement"])';
    $handle = 'li:has-text("Interaction with colleagues was productive") [aria-label="Drag to reorder"]';
    $archivedToggle = 'button:has-text("Disabled (1)")';
    $announcement = "document.querySelector('[id^=\"DndLiveRegion\"]').textContent";

    $page = $this->signIn($olivia, route('teams.show', [$team->workspace, $team], false));

    $page->assertSeeIn('[data-slot="health-check-summary"] h2', 'Health check')
        ->assertSeeIn('[data-slot="health-check-summary-facts"]', '6 statements, scored 1–5, asked in every health check')
        ->assertScript(p08bTeamSummary(), p08bBuiltIns())
        ->assertNotPresent('[aria-label="Drag to reorder"]')
        ->assertNotPresent('[aria-label="Statement"]')
        ->assertSeeIn('[data-slot="health-check-manage"]', 'Manage')
        ->click('[data-slot="health-check-manage"]')
        ->assertPathIs(route('teams.healthCheck.show', [$team->workspace, $team], false));

    $page->assertSee('Health check statements')
        ->assertSee('Changes apply to retros that have not collected answers yet.')
        ->assertCount($active, 6)
        ->assertScript(p08bTeamStatements(), p08bBuiltIns())
        ->assertNotPresent("{$manager} button:has-text(\"Edit\")");

    $page->fill('[aria-label="Statement"]', 'We shipped what we promised')
        ->fill('[aria-label="Short label"]', 'Delivery')
        ->click('button:has-text("Add statement")')
        ->assertSee('Statement added.')
        ->assertCount($active, 7)
        ->assertSeeIn($custom, 'Delivery')
        ->assertPresent("{$custom} button:has-text(\"Edit\")");

    $page->click("{$manager} button:has-text(\"Disable\")")
        ->assertPresent($archivedToggle)
        ->assertCount($active, 6);

    $page->keys($handle, 'Space')
        ->assertAttribute($handle, 'aria-pressed', 'true');
    $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 0))');
    $page->keys($handle, 'ArrowDown')
        ->assertScript($announcement, 'Moving: Interaction. Position 2 of 6.')
        ->keys($handle, 'Space')
        ->assertAttributeMissing($handle, 'aria-pressed');

    $page->assertScript(p08bTeamStatements(), implode(' | ', [
        'Tasks assigned to me were clear',
        'Interaction with colleagues was productive',
        'The vision and goals are clear to me',
        'Our processes let me work without blockers',
        'I felt motivated in my work',
        'We shipped what we promised',
    ]));

    $page->click("{$custom} button:has-text(\"Edit\")")
        ->assertVisible("{$editing} input[name=\"text\"]")
        ->fill("{$editing} input[name=\"text\"]", 'We delivered what we promised')
        ->click("{$editing} button:has-text(\"Save\")")
        ->assertSee('Statement updated.')
        ->assertNotPresent($editing)
        ->assertSeeIn('li:has-text("We delivered what we promised")', 'Delivery');

    $page->click($archivedToggle)
        ->assertVisible('button:has-text("Enable")')
        ->click('button:has-text("Enable")')
        ->assertCount($active, 7)
        ->assertNotPresent($archivedToggle)
        ->assertPresent("{$manager} button:has-text(\"Disable\")")
        ->click("{$manager} button:has-text(\"Disable\")")
        ->assertPresent($archivedToggle)
        ->assertCount($active, 6);

    $statements = $team->healthStatements()->get();

    expect($statements)->toHaveCount(7)
        ->and($statements->firstWhere('builtin', HealthStatement::ManagerSupport)->archived_at)->not->toBeNull()
        ->and($statements->whereNull('builtin')->sole()->text)->toBe('We delivered what we promised')
        ->and($statements->whereNull('builtin')->sole()->label)->toBe('Delivery')
        ->and($statements->whereNull('archived_at')->first()->builtin)->toBe(HealthStatement::TaskClarity);
});

it('[P08b-01b] shows the health check statements to a plain member as a read-only list, on the team page and on the health check page', function () {
    $team = Team::factory()->create();
    $bob = teamMember($team);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    $page = $this->signIn($bob, route('teams.show', [$team->workspace, $team], false));

    $page->assertSeeIn('[data-slot="health-check-summary"] h2', 'Health check')
        ->assertSee('Changes apply to retros that have not collected answers yet.')
        ->assertScript(p08bTeamSummary(), p08bBuiltIns())
        ->assertNotPresent('[aria-label="Drag to reorder"]')
        ->assertNotPresent('button:has-text("Disable")')
        ->assertSeeIn('[data-slot="health-check-manage"]', 'Details')
        ->click('[data-slot="health-check-manage"]')
        ->assertPathIs(route('teams.healthCheck.show', [$team->workspace, $team], false));

    $page->assertSee('Health check statements')
        ->assertSee('Changes apply to retros that have not collected answers yet.')
        ->assertScript(p08bTeamStatements(), p08bBuiltIns())
        ->assertNotPresent('[aria-label="Drag to reorder"]')
        ->assertNotPresent('[aria-label="Statement"]')
        ->assertNotPresent('button:has-text("Add statement")')
        ->assertNotPresent('button:has-text("Disable")')
        ->assertNotPresent('button:has-text("Enable")');

    expect($team->healthStatements()->count())->toBe(0);
});

it('[P08b-02] attaches a health check to a new retro, which opens on Writing and asks the active statements of the team in their order', function () {
    $team = Team::factory()->create();
    $alice = teamMember($team);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    TeamHealthStatement::factory()->builtin(HealthStatement::Vision)->create(['team_id' => $team->id, 'position' => 0]);
    $custom = TeamHealthStatement::factory()->create([
        'team_id' => $team->id,
        'text' => 'We shipped what we promised',
        'label' => 'Delivery',
        'position' => 1,
    ]);
    TeamHealthStatement::factory()->builtin(HealthStatement::Motivation)->create(['team_id' => $team->id, 'position' => 2]);
    TeamHealthStatement::factory()->builtin(HealthStatement::Interaction)->create(['team_id' => $team->id, 'position' => 3]);
    TeamHealthStatement::factory()->builtin(HealthStatement::ManagerSupport)->archived()->create(['team_id' => $team->id, 'position' => 4]);

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New session')
        ->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 15 retro')
        ->assertCount('[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"][aria-checked="true"]', 1)
        ->assertVisible('#new-retro-health-check')
        ->click('#new-retro-health-check')
        ->assertAttribute('#new-retro-health-check', 'aria-checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header >> h1', 'Sprint 15 retro')
        ->assertSeeIn('[aria-current="step"]', 'Writing')
        ->assertCount('[aria-label="Add a card…"], button:has-text("Add a card")', 3)
        ->assertSeeIn(p08bButton(), '0/1')
        ->assertPresent('[data-slot="health-check-todo"]');

    p08bOpen($page)
        ->assertSeeIn(p08bDialog(), '1 · Strongly disagree')
        ->assertSeeIn(p08bDialog(), '5 · Strongly agree')
        ->assertScript(p08bDialogStatements(), implode(' | ', [
            'The vision and goals are clear to me',
            'We shipped what we promised',
            'I felt motivated in my work',
            'Interaction with colleagues was productive',
        ]))
        ->assertCount(p08bDialog().' [role="radiogroup"] [role="radio"]', 20)
        ->assertDontSeeIn(p08bDialog(), 'My manager was understanding and supportive')
        ->assertSeeIn(p08bDialog(), '0 of 4 answered')
        ->assertDisabled(p08bSubmit());

    $retro = Retro::query()->where('title', 'Sprint 15 retro')->firstOrFail();
    $survey = p08bSurvey($retro);

    expect($retro->phase)->toBe(RetroPhase::Writing)
        ->and($survey->status)->toBe(TeamSurveyStatus::Open)
        ->and($survey->questions()->pluck('match_key')->all())->toBe(['vision', $custom->id, 'motivation', 'interaction'])
        ->and($survey->questions()->pluck('scale_max')->unique()->all())->toBe([5]);
});

it('[P08b-03a] shows how many have sent their answers, and never a score of someone else', function () {
    [$retro, , $alice, , $aliceParticipant] = p08bBoard();
    $keys = 'surveyId,isClosed,scale,respondents,participants,hasSubmitted,submittedBy,statements,results';
    $fields = 'isBuiltin,key,label,myScore,text';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertSeeIn(p08bButton(), '0/3');

    p08bScoreAll(p08bOpen($alicePage), [4, 4, 3, 5, 2, 4])
        ->assertSeeIn(p08bDialog(), '6 of 6 answered')
        ->assertEnabled(p08bSubmit())
        ->click(p08bSubmit())
        ->assertSeeIn(p08bDialog(), 'Answers sent. Thank you.')
        ->assertNotPresent(p08bSubmit())
        ->assertCount(p08bDialog().' [role="radiogroup"][aria-readonly="true"]', 6)
        ->assertCount(p08bChecked(), 6)
        ->assertSeeIn(p08bButton(), '1/3')
        ->assertNotPresent('[data-slot="health-check-todo"]');

    $carolPage->assertSeeIn(p08bButton(), '1/3')
        ->assertPresent('[data-slot="health-check-todo"]');

    p08bOpen($carolPage)
        ->assertNotPresent(p08bChecked())
        ->assertSeeIn(p08bDialog(), '0 of 6 answered')
        ->assertNotPresent(p08bDialog().' img');

    $carolView = p08bHealthSnapshot($this->snapshotOf($carolPage, "/retros/{$retro->id}/snapshot"));

    expect($carolView['keys'])->toBe($keys)
        ->and($carolView['fields'])->toBe($fields)
        ->and($carolView['myScores'])->toBe([null, null, null, null, null, null])
        ->and($carolView['respondents'])->toBe(1)
        ->and($carolView['participants'])->toBe(3)
        ->and($carolView['hasSubmitted'])->toBeFalse()
        ->and($carolView['results'])->toBeNull()
        ->and($carolView['json'])->not->toContain($aliceParticipant->id);

    $aliceView = p08bHealthSnapshot($this->snapshotOf($alicePage, "/retros/{$retro->id}/snapshot"));

    expect($aliceView['myScores'])->toBe([4, 4, 3, 5, 2, 4])
        ->and($aliceView['hasSubmitted'])->toBeTrue()
        ->and($aliceView['results'])->toBeNull()
        ->and(TeamSurveyAnswer::query()->orderBy('value')->pluck('value')->all())->toBe([2, 3, 4, 4, 4, 5]);
});

it('[P08b-03c] shows the facilitator of a named retro, live, the avatars of who has sent their answers, and nobody else', function () {
    [$retro, , $alice, $bob] = p08bBoard(['is_anonymous' => false]);
    $senders = '[data-slot="health-check-senders"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    p08bOpen($alicePage)
        ->assertSeeIn($senders, 'Who has sent their answers')
        ->assertSeeIn($senders, '0/2')
        ->assertNotPresent("{$senders} [data-slot=\"person-avatar\"]");

    p08bScoreAll(p08bOpen($bobPage), [4, 4, 3, 5, 2, 4])
        ->click(p08bSubmit())
        ->assertSeeIn(p08bDialog(), 'Answers sent. Thank you.')
        ->assertNotPresent($senders);

    $alicePage->assertSeeIn($senders, '1/2')
        ->assertPresent("{$senders} [aria-label*=\"Bob Stone\"]");
});

it('[P08b-03d] names nobody who has sent their answers on an anonymous retro, to the facilitator neither', function () {
    [$retro, , $alice, , , $bobParticipant] = p08bBoard(['is_anonymous' => true]);
    answerHealthCheck($retro, $bobParticipant, p08bScores());

    p08bOpen($this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}")))
        ->assertSeeIn(p08bButton(), '1/2')
        ->assertNotPresent('[data-slot="health-check-senders"]');
});

it('[P08b-03b] keeps the unsent scores until a reload, sends them only once every statement is scored, and never changes them once sent', function () {
    [$retro, , , $bob, , $bobParticipant] = p08bBoard();
    [$interaction, $tasks] = p08bBuiltInTexts();

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    p08bOpen($page)
        ->click(p08bScore($interaction, 2))
        ->click(p08bScore($tasks, 5))
        ->assertCount(p08bChecked(), 2)
        ->assertSeeIn(p08bDialog(), '2 of 6 answered')
        ->assertDisabled(p08bSubmit())
        ->keys(p08bDialog(), 'Escape')
        ->assertNotPresent(p08bDialog());

    p08bOpen($page)
        ->assertAttribute(p08bScore($interaction, 2), 'aria-checked', 'true')
        ->assertAttribute(p08bScore($tasks, 5), 'aria-checked', 'true')
        ->assertSeeIn(p08bDialog(), '2 of 6 answered');

    expect(TeamSurveyAnswer::query()->count())->toBe(0);

    $page->navigate("/retros/{$retro->id}");

    p08bOpen($this->awaitRealtime($page))
        ->assertNotPresent(p08bChecked())
        ->assertSeeIn(p08bDialog(), '0 of 6 answered');

    p08bScoreAll($page, [2, 5, 3, 3, 4, 1])
        ->click(p08bSubmit())
        ->assertSeeIn(p08bDialog(), 'Answers sent. Thank you.')
        ->assertNotPresent(p08bSubmit())
        ->assertAttribute(p08bDialog()." [role=\"radiogroup\"][aria-label=\"{$interaction}\"]", 'aria-readonly', 'true')
        ->assertAttribute(p08bScore($interaction, 5), 'aria-disabled', 'true')
        ->assertAttribute(p08bScore($interaction, 2), 'aria-checked', 'true');

    $respondent = p08bSurvey($retro)->respondents()->sole();

    expect($respondent->participant_id)->toBe($bobParticipant->id)
        ->and($respondent->completed_at)->not->toBeNull()
        ->and(TeamSurveyAnswer::query()->orderBy('value')->pluck('value')->all())->toBe([1, 2, 3, 3, 4, 5]);
});

it('[P08b-03c] keeps the five score buttons on one row, in the dialog and in the drawer a phone opens from the header menu', function () {
    [$retro, , , $bob] = p08bBoard();
    $rows = fn (string $container): string => "(() => { const tops = [...document.querySelectorAll('{$container} [role=\"radiogroup\"][aria-label=\"Interaction with colleagues was productive\"] [role=\"radio\"]')].map((button) => Math.round(button.getBoundingClientRect().top)); return [...new Set(tops)].map((top) => tops.filter((value) => value === top).length).join(','); })()";
    $drawer = '[data-slot="retro-health-check-drawer"]';

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    p08bOpen($page)
        ->assertScript($rows(p08bDialog()), '5')
        ->keys(p08bDialog(), 'Escape')
        ->assertNotPresent(p08bDialog())
        ->resize(375, 812)
        ->assertNotPresent(p08bButton())
        ->click('[aria-label="Menu"]')
        ->assertPresent('[role="menuitem"]:has-text("Health check")')
        ->click('[role="menuitem"]:has-text("Health check")')
        ->assertVisible("{$drawer} [role=\"radiogroup\"][aria-label=\"Interaction with colleagues was productive\"]")
        ->assertScript($rows($drawer), '5');
});

it('[P08b-04] names nobody on an anonymous retro: counts only, and no participant id in the snapshot', function () {
    [$retro, , $alice, $bob, $aliceParticipant] = p08bBoard(['is_anonymous' => true]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    p08bScoreAll(p08bOpen($alicePage), [3, 3, 3, 3, 3, 3])
        ->click(p08bSubmit())
        ->assertSeeIn(p08bDialog(), 'Answers sent. Thank you.');

    $bobPage->assertSeeIn(p08bButton(), '1/2');

    p08bOpen($bobPage)
        ->assertNotPresent(p08bDialog().' img')
        ->assertNotPresent(p08bChecked());

    $bobView = p08bHealthSnapshot($this->snapshotOf($bobPage, "/retros/{$retro->id}/snapshot"));

    expect($bobView['respondents'])->toBe(1)
        ->and($bobView['myScores'])->toBe([null, null, null, null, null, null])
        ->and($bobView['results'])->toBeNull()
        ->and($bobView['json'])->not->toContain($aliceParticipant->id);
});

it('[P08b-05a] disables the score buttons for everyone when the board is closed for editing', function () {
    [$retro, , $alice, $bob] = p08bBoard();
    [$interaction] = p08bBuiltInTexts();
    $disabled = "document.querySelectorAll('[data-slot=\"retro-health-check-dialog\"] [role=\"radio\"]:disabled').length";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    p08bOpen($bobPage)
        ->assertEnabled(p08bScore($interaction, 4))
        ->assertScript($disabled, 0);

    openRetroSettings($alicePage)
        ->click('#retro-locked')
        ->assertAttribute('#retro-locked', 'aria-checked', 'true')
        ->click('[role="dialog"] button:has-text("Apply")')
        ->assertSeeIn('[role="dialog"]', 'No changes')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Board closed for editing');

    p08bOpen($alicePage)
        ->assertSeeIn(p08bDialog(), 'The board is closed for editing.')
        ->assertScript($disabled, 30)
        ->assertDisabled(p08bSubmit());

    $bobPage->assertSeeIn(p08bDialog(), 'The board is closed for editing.')
        ->assertDisabled(p08bScore($interaction, 4))
        ->assertScript($disabled, 30);

    expect($retro->fresh()->is_locked)->toBeTrue()
        ->and(TeamSurveyAnswer::query()->count())->toBe(0);
});

it('[P08b-05b] shows the refusal and resyncs when the answers are sent to a board closed for editing', function () {
    [$retro, , , $bob] = p08bBoard();

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    p08bScoreAll(p08bOpen($page), [4, 4, 4, 4, 4, 4])
        ->assertSeeIn(p08bDialog(), '6 of 6 answered')
        ->assertEnabled(p08bSubmit());

    $retro->update(['is_locked' => true]);

    $page->click(p08bSubmit())
        ->assertSee('The board is closed for editing.')
        ->assertSee('Board closed for editing')
        ->assertDisabled(p08bSubmit())
        ->assertDontSeeIn(p08bDialog(), 'Answers sent. Thank you.')
        ->assertSeeIn(p08bButton(), '0/2');

    expect(TeamSurveyAnswer::query()->count())->toBe(0);
});

it('[P08b-06] takes the answers in any open phase, and shows the results to everyone once the facilitator closes the health check', function () {
    [$retro, , $alice, $bob, $aliceParticipant] = p08bBoard([], RetroPhase::Discussing);
    answerHealthCheck($retro, $aliceParticipant, p08bScores(4));
    $confirm = '[role="alertdialog"] button:has-text("Close the health check")';
    $results = p08bDialog().' [data-slot="health-check-compact"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSeeIn('[aria-current="step"]', 'Discussing')
        ->assertSeeIn(p08bButton(), '1/2');

    p08bScoreAll(p08bOpen($bobPage), [2, 2, 2, 2, 2, 2])
        ->click(p08bSubmit())
        ->assertSeeIn(p08bDialog(), 'Answers sent. Thank you.')
        ->assertSeeIn(p08bButton(), '2/2')
        ->assertNotPresent(p08bDialog().' button:has-text("Close the health check")');

    $alicePage->assertSeeIn(p08bButton(), '2/2');

    p08bOpen($alicePage)
        ->click(p08bDialog().' button:has-text("Close the health check")')
        ->assertSeeIn('[role="alertdialog"]', 'Everyone will see the results.')
        ->click($confirm)
        ->assertNotPresent('[role="alertdialog"]')
        ->assertSeeIn($results, '2 answers · avg 3.0')
        ->assertPresent(p08bDialog().' button:has-text("Reopen")');

    $bobPage->assertSeeIn($results, '2 answers · avg 3.0')
        ->assertNotPresent(p08bDialog().' [role="radiogroup"]')
        ->assertNotPresent(p08bDialog().' button:has-text("Reopen")');

    expect(p08bSurvey($retro)->status)->toBe(TeamSurveyStatus::Closed);

    $alicePage->click(p08bDialog().' button:has-text("Reopen")')
        ->assertNotPresent($results)
        ->assertSeeIn(p08bDialog(), 'Answers sent. Thank you.');

    $bobPage->assertNotPresent($results)
        ->assertSeeIn(p08bDialog(), 'Answers sent. Thank you.');

    expect(p08bSurvey($retro)->status)->toBe(TeamSurveyStatus::Open)
        ->and(TeamSurveyAnswer::query()->count())->toBe(12);
});

it('[P08b-07] keeps the statements of a health check once it has answers, and brings them back when it is removed and added again', function () {
    [$retro, , $alice, , , $bobParticipant] = p08bBoard();
    answerHealthCheck($retro, $bobParticipant, p08bScores(3));
    $unanswered = Retro::factory()->inPhase(RetroPhase::Writing)->withHealthCheck()->create(['team_id' => $retro->team_id]);
    $olivia = workspaceManager($retro->team->workspace, WorkspaceRole::Owner);
    $olivia->update(['name' => 'Olivia Owner', 'locale' => 'en']);
    $frozenKeys = ['interaction', 'task_clarity', 'manager_support', 'vision', 'processes', 'motivation'];

    $teamPage = $this->signIn($olivia, route('teams.healthCheck.show', [$retro->team->workspace, $retro->team], false));

    $teamPage->assertVisible('[aria-label="Statement"]')
        ->fill('[aria-label="Statement"]', 'We shipped what we promised')
        ->fill('[aria-label="Short label"]', 'Delivery')
        ->click('button:has-text("Add statement")')
        ->assertSee('Statement added.')
        ->assertCount('li:has([aria-label="Drag to reorder"])', 7);

    expect($retro->team->healthStatements()->count())->toBe(7)
        ->and(p08bSurvey($retro)->questions()->pluck('match_key')->all())->toBe($frozenKeys)
        ->and(p08bSurvey($unanswered)->questions()->count())->toBe(7);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    p08bOpen($alicePage)
        ->assertScript(p08bDialogStatements(), p08bBuiltIns())
        ->click(p08bDialog().' button:has-text("Remove")')
        ->assertSeeIn('[role="alertdialog"]', 'Any answers it holds are kept and come back if you add it again.')
        ->click('[role="alertdialog"] button:has-text("Remove")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertNotPresent(p08bDialog())
        ->assertNotPresent(p08bButton());

    expect(p08bSurvey($retro)->status)->toBe(TeamSurveyStatus::Draft)
        ->and(TeamSurveyAnswer::query()->count())->toBe(6);

    openRetroSettings($alicePage)
        ->click('[role="dialog"] button:has-text("Add survey")')
        ->assertPresent('[role="menuitem"]:has-text("Health check")')
        ->click('[role="menuitem"]:has-text("Health check")')
        ->assertSeeIn(p08bButton(), '1/2');

    $alicePage->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]');

    p08bOpen($alicePage)
        ->assertScript(p08bDialogStatements(), p08bBuiltIns())
        ->assertDontSeeIn(p08bDialog(), 'We shipped what we promised');

    expect(p08bSurvey($retro)->status)->toBe(TeamSurveyStatus::Open)
        ->and(p08bSurvey($retro)->questions()->pluck('match_key')->all())->toBe($frozenKeys)
        ->and(TeamSurveyAnswer::query()->count())->toBe(6);
});
