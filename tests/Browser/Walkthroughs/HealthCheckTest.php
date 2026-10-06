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
function healthCheckBoard(array $attributes = [], RetroPhase $phase = RetroPhase::Writing): array
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
function healthCheckScores(int $score = 4): array
{
    return array_fill_keys(['interaction', 'task_clarity', 'manager_support', 'vision', 'processes', 'motivation'], $score);
}

function healthCheckSurvey(Retro $retro): TeamSurvey
{
    return TeamSurvey::query()->where('retro_id', $retro->id)->sole();
}

function healthCheckButton(): string
{
    return 'button:has([data-slot="health-check-count"])';
}

function healthCheckDialog(): string
{
    return '[data-slot="retro-health-check-dialog"]';
}

function healthCheckScore(string $statement, int $score): string
{
    return healthCheckDialog()." [role=\"radiogroup\"][aria-label=\"{$statement}\"] [aria-label=\"Score {$score}\"]";
}

function healthCheckChecked(): string
{
    return healthCheckDialog().' [role="radio"][aria-checked="true"]';
}

function healthCheckSubmit(): string
{
    return healthCheckDialog().' button:has-text("Submit answers")';
}

function healthCheckBuiltInTexts(): array
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

function healthCheckBuiltIns(): string
{
    return implode(' | ', healthCheckBuiltInTexts());
}

function healthCheckTeamStatements(): string
{
    return "[...[...document.querySelectorAll('section')].find((section) => section.querySelector('h2')?.textContent === 'Health check statements').querySelectorAll('ol > li')].map((row) => row.querySelector('p').textContent).join(' | ')";
}

function healthCheckTeamSummary(): string
{
    return "[...document.querySelectorAll('[data-slot=\"health-check-summary-statement\"]')].map((row) => row.lastElementChild.textContent).join(' | ')";
}

function healthCheckDialogStatements(): string
{
    return "[...document.querySelectorAll('[data-slot=\"retro-health-check-dialog\"] [role=\"radiogroup\"]')].map((group) => group.getAttribute('aria-label')).join(' | ')";
}

function healthCheckOpen(mixed $page): mixed
{
    $page->click(healthCheckButton())
        ->assertVisible(healthCheckDialog());

    return $page;
}

/**
 * @param  array<int, int>  $scores  one score per built-in statement, in order
 */
function healthCheckScoreAll(mixed $page, array $scores): mixed
{
    foreach (healthCheckBuiltInTexts() as $index => $statement) {
        $page->click(healthCheckScore($statement, $scores[$index]))
            ->assertAttribute(healthCheckScore($statement, $scores[$index]), 'aria-checked', 'true');
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
function healthCheckHealthSnapshot(array $snapshot): array
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

it('lets an Owner add, archive, reorder, reword and restore the health check statements of a team, on the Rituals page "Edit the statements" leads to', function () {
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

    $page = $this->signIn($olivia, route('teams.healthCheck.show', [$team->workspace, $team], false));

    $page->assertSeeIn('[data-slot="team-health-check"] h2', 'Health check')
        ->assertNotPresent('[aria-label="Drag to reorder"]')
        ->assertNotPresent('[aria-label="Statement"]')
        ->click('[data-slot="team-health-check"] a:has-text("Edit the statements")')
        ->assertPathIs(route('teams.healthStatements.index', [$team->workspace, $team], false));

    $page->assertSee('Health check statements')
        ->assertSee('Changes apply to retros that have not collected answers yet.')
        ->assertCount($active, 6)
        ->assertScript(healthCheckTeamStatements(), healthCheckBuiltIns())
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

    $page->assertScript(healthCheckTeamStatements(), implode(' | ', [
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

it('shows the health check statements to a plain member as a read-only list, on the team page and on the health check page', function () {
    $team = Team::factory()->create();
    $bob = teamMember($team);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    $page = $this->signIn($bob, route('teams.show', [$team->workspace, $team], false));

    $page->assertSeeIn('[data-slot="health-check-summary"] h2', 'Health check')
        ->assertSee('Changes apply to retros that have not collected answers yet.')
        ->assertScript(healthCheckTeamSummary(), healthCheckBuiltIns())
        ->assertNotPresent('[aria-label="Drag to reorder"]')
        ->assertNotPresent('button:has-text("Disable")')
        ->assertSeeIn('[data-slot="health-check-manage"]', 'Details')
        ->click('[data-slot="health-check-manage"]')
        ->assertPathIs(route('teams.healthCheck.show', [$team->workspace, $team], false));

    $page->assertSee('Health check statements')
        ->assertSee('Changes apply to retros that have not collected answers yet.')
        ->assertScript(healthCheckTeamStatements(), healthCheckBuiltIns())
        ->assertNotPresent('[aria-label="Drag to reorder"]')
        ->assertNotPresent('[aria-label="Statement"]')
        ->assertNotPresent('button:has-text("Add statement")')
        ->assertNotPresent('button:has-text("Disable")')
        ->assertNotPresent('button:has-text("Enable")');

    expect($team->healthStatements()->count())->toBe(0);
})->skip('navigation redesign: awaiting the owner');

it('attaches a health check to a new retro, which opens on Writing and asks the active statements of the team in their order', function () {
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
        ->assertSeeIn(healthCheckButton(), '0/1')
        ->assertPresent('[data-slot="health-check-todo"]');

    healthCheckOpen($page)
        ->assertSeeIn(healthCheckDialog(), '1 · Strongly disagree')
        ->assertSeeIn(healthCheckDialog(), '5 · Strongly agree')
        ->assertScript(healthCheckDialogStatements(), implode(' | ', [
            'The vision and goals are clear to me',
            'We shipped what we promised',
            'I felt motivated in my work',
            'Interaction with colleagues was productive',
        ]))
        ->assertCount(healthCheckDialog().' [role="radiogroup"] [role="radio"]', 20)
        ->assertDontSeeIn(healthCheckDialog(), 'My manager was understanding and supportive')
        ->assertSeeIn(healthCheckDialog(), '0 of 4 answered')
        ->assertDisabled(healthCheckSubmit());

    $retro = Retro::query()->where('title', 'Sprint 15 retro')->firstOrFail();
    $survey = healthCheckSurvey($retro);

    expect($retro->phase)->toBe(RetroPhase::Writing)
        ->and($survey->status)->toBe(TeamSurveyStatus::Open)
        ->and($survey->questions()->pluck('match_key')->all())->toBe(['vision', $custom->id, 'motivation', 'interaction'])
        ->and($survey->questions()->pluck('scale_max')->unique()->all())->toBe([5]);
});

it('shows how many have sent their answers, and never a score of someone else', function () {
    [$retro, , $alice, , $aliceParticipant] = healthCheckBoard();
    $keys = 'surveyId,isClosed,scale,respondents,participants,hasSubmitted,submittedBy,statements,results';
    $fields = 'isBuiltin,key,label,myScore,text';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertSeeIn(healthCheckButton(), '0/3');

    healthCheckScoreAll(healthCheckOpen($alicePage), [4, 4, 3, 5, 2, 4])
        ->assertSeeIn(healthCheckDialog(), '6 of 6 answered')
        ->assertEnabled(healthCheckSubmit())
        ->click(healthCheckSubmit())
        ->assertSeeIn(healthCheckDialog(), 'Answers sent. Thank you.')
        ->assertNotPresent(healthCheckSubmit())
        ->assertCount(healthCheckDialog().' [role="radiogroup"][aria-readonly="true"]', 6)
        ->assertCount(healthCheckChecked(), 6)
        ->assertSeeIn(healthCheckButton(), '1/3')
        ->assertNotPresent('[data-slot="health-check-todo"]');

    $carolPage->assertSeeIn(healthCheckButton(), '1/3')
        ->assertPresent('[data-slot="health-check-todo"]');

    healthCheckOpen($carolPage)
        ->assertNotPresent(healthCheckChecked())
        ->assertSeeIn(healthCheckDialog(), '0 of 6 answered')
        ->assertNotPresent(healthCheckDialog().' img');

    $carolView = healthCheckHealthSnapshot($this->snapshotOf($carolPage, "/retros/{$retro->id}/snapshot"));

    expect($carolView['keys'])->toBe($keys)
        ->and($carolView['fields'])->toBe($fields)
        ->and($carolView['myScores'])->toBe([null, null, null, null, null, null])
        ->and($carolView['respondents'])->toBe(1)
        ->and($carolView['participants'])->toBe(3)
        ->and($carolView['hasSubmitted'])->toBeFalse()
        ->and($carolView['results'])->toBeNull()
        ->and($carolView['json'])->not->toContain($aliceParticipant->id);

    $aliceView = healthCheckHealthSnapshot($this->snapshotOf($alicePage, "/retros/{$retro->id}/snapshot"));

    expect($aliceView['myScores'])->toBe([4, 4, 3, 5, 2, 4])
        ->and($aliceView['hasSubmitted'])->toBeTrue()
        ->and($aliceView['results'])->toBeNull()
        ->and(TeamSurveyAnswer::query()->orderBy('value')->pluck('value')->all())->toBe([2, 3, 4, 4, 4, 5]);
});

it('shows the facilitator of a named retro, live, the avatars of who has sent their answers, and nobody else', function () {
    [$retro, , $alice, $bob] = healthCheckBoard(['is_anonymous' => false]);
    $senders = '[data-slot="health-check-senders"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    healthCheckOpen($alicePage)
        ->assertSeeIn($senders, 'Who has sent their answers')
        ->assertSeeIn($senders, '0/2')
        ->assertNotPresent("{$senders} [data-slot=\"person-avatar\"]");

    healthCheckScoreAll(healthCheckOpen($bobPage), [4, 4, 3, 5, 2, 4])
        ->click(healthCheckSubmit())
        ->assertSeeIn(healthCheckDialog(), 'Answers sent. Thank you.')
        ->assertNotPresent($senders);

    $alicePage->assertSeeIn($senders, '1/2')
        ->assertPresent("{$senders} [aria-label*=\"Bob Stone\"]");
});

it('names nobody who has sent their answers on an anonymous retro, to the facilitator neither', function () {
    [$retro, , $alice, , , $bobParticipant] = healthCheckBoard(['is_anonymous' => true]);
    answerHealthCheck($retro, $bobParticipant, healthCheckScores());

    healthCheckOpen($this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}")))
        ->assertSeeIn(healthCheckButton(), '1/2')
        ->assertNotPresent('[data-slot="health-check-senders"]');
});

it('keeps the unsent scores until a reload, sends them only once every statement is scored, and never changes them once sent', function () {
    [$retro, , , $bob, , $bobParticipant] = healthCheckBoard();
    [$interaction, $tasks] = healthCheckBuiltInTexts();

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    healthCheckOpen($page)
        ->click(healthCheckScore($interaction, 2))
        ->click(healthCheckScore($tasks, 5))
        ->assertCount(healthCheckChecked(), 2)
        ->assertSeeIn(healthCheckDialog(), '2 of 6 answered')
        ->assertDisabled(healthCheckSubmit())
        ->keys(healthCheckDialog(), 'Escape')
        ->assertNotPresent(healthCheckDialog());

    healthCheckOpen($page)
        ->assertAttribute(healthCheckScore($interaction, 2), 'aria-checked', 'true')
        ->assertAttribute(healthCheckScore($tasks, 5), 'aria-checked', 'true')
        ->assertSeeIn(healthCheckDialog(), '2 of 6 answered');

    expect(TeamSurveyAnswer::query()->count())->toBe(0);

    $page->navigate("/retros/{$retro->id}");

    healthCheckOpen($this->awaitRealtime($page))
        ->assertNotPresent(healthCheckChecked())
        ->assertSeeIn(healthCheckDialog(), '0 of 6 answered');

    healthCheckScoreAll($page, [2, 5, 3, 3, 4, 1])
        ->click(healthCheckSubmit())
        ->assertSeeIn(healthCheckDialog(), 'Answers sent. Thank you.')
        ->assertNotPresent(healthCheckSubmit())
        ->assertAttribute(healthCheckDialog()." [role=\"radiogroup\"][aria-label=\"{$interaction}\"]", 'aria-readonly', 'true')
        ->assertAttribute(healthCheckScore($interaction, 5), 'aria-disabled', 'true')
        ->assertAttribute(healthCheckScore($interaction, 2), 'aria-checked', 'true');

    $respondent = healthCheckSurvey($retro)->respondents()->sole();

    expect($respondent->participant_id)->toBe($bobParticipant->id)
        ->and($respondent->completed_at)->not->toBeNull()
        ->and(TeamSurveyAnswer::query()->orderBy('value')->pluck('value')->all())->toBe([1, 2, 3, 3, 4, 5]);
});

it('keeps the five score buttons on one row, in the dialog and in the drawer a phone opens from the header menu', function () {
    [$retro, , , $bob] = healthCheckBoard();
    $rows = fn (string $container): string => "(() => { const tops = [...document.querySelectorAll('{$container} [role=\"radiogroup\"][aria-label=\"Interaction with colleagues was productive\"] [role=\"radio\"]')].map((button) => Math.round(button.getBoundingClientRect().top)); return [...new Set(tops)].map((top) => tops.filter((value) => value === top).length).join(','); })()";
    $drawer = '[data-slot="retro-health-check-drawer"]';

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    healthCheckOpen($page)
        ->assertScript($rows(healthCheckDialog()), '5')
        ->keys(healthCheckDialog(), 'Escape')
        ->assertNotPresent(healthCheckDialog())
        ->resize(375, 812)
        ->assertNotPresent(healthCheckButton())
        ->click('[aria-label="Menu"]')
        ->assertPresent('[role="menuitem"]:has-text("Health check")')
        ->click('[role="menuitem"]:has-text("Health check")')
        ->assertVisible("{$drawer} [role=\"radiogroup\"][aria-label=\"Interaction with colleagues was productive\"]")
        ->assertScript($rows($drawer), '5');
});

it('names nobody on an anonymous retro: counts only, and no participant id in the snapshot', function () {
    [$retro, , $alice, $bob, $aliceParticipant] = healthCheckBoard(['is_anonymous' => true]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    healthCheckScoreAll(healthCheckOpen($alicePage), [3, 3, 3, 3, 3, 3])
        ->click(healthCheckSubmit())
        ->assertSeeIn(healthCheckDialog(), 'Answers sent. Thank you.');

    $bobPage->assertSeeIn(healthCheckButton(), '1/2');

    healthCheckOpen($bobPage)
        ->assertNotPresent(healthCheckDialog().' img')
        ->assertNotPresent(healthCheckChecked());

    $bobView = healthCheckHealthSnapshot($this->snapshotOf($bobPage, "/retros/{$retro->id}/snapshot"));

    expect($bobView['respondents'])->toBe(1)
        ->and($bobView['myScores'])->toBe([null, null, null, null, null, null])
        ->and($bobView['results'])->toBeNull()
        ->and($bobView['json'])->not->toContain($aliceParticipant->id);
});

it('disables the score buttons for everyone when the board is closed for editing', function () {
    [$retro, , $alice, $bob] = healthCheckBoard();
    [$interaction] = healthCheckBuiltInTexts();
    $disabled = "document.querySelectorAll('[data-slot=\"retro-health-check-dialog\"] [role=\"radio\"]:disabled').length";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    healthCheckOpen($bobPage)
        ->assertEnabled(healthCheckScore($interaction, 4))
        ->assertScript($disabled, 0);

    openRetroSettings($alicePage)
        ->click('#retro-locked')
        ->assertAttribute('#retro-locked', 'aria-checked', 'true')
        ->click('[role="dialog"] button:has-text("Apply")')
        ->assertSeeIn('[role="dialog"]', 'No changes')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Board closed for editing');

    healthCheckOpen($alicePage)
        ->assertSeeIn(healthCheckDialog(), 'The board is closed for editing.')
        ->assertScript($disabled, 30)
        ->assertDisabled(healthCheckSubmit());

    $bobPage->assertSeeIn(healthCheckDialog(), 'The board is closed for editing.')
        ->assertDisabled(healthCheckScore($interaction, 4))
        ->assertScript($disabled, 30);

    expect($retro->fresh()->is_locked)->toBeTrue()
        ->and(TeamSurveyAnswer::query()->count())->toBe(0);
});

it('shows the refusal and resyncs when the answers are sent to a board closed for editing', function () {
    [$retro, , , $bob] = healthCheckBoard();

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    healthCheckScoreAll(healthCheckOpen($page), [4, 4, 4, 4, 4, 4])
        ->assertSeeIn(healthCheckDialog(), '6 of 6 answered')
        ->assertEnabled(healthCheckSubmit());

    $retro->update(['is_locked' => true]);

    $page->click(healthCheckSubmit())
        ->assertSee('The board is closed for editing.')
        ->assertSee('Board closed for editing')
        ->assertDisabled(healthCheckSubmit())
        ->assertDontSeeIn(healthCheckDialog(), 'Answers sent. Thank you.')
        ->assertSeeIn(healthCheckButton(), '0/2');

    expect(TeamSurveyAnswer::query()->count())->toBe(0);
});

it('takes the answers in any open phase, and shows the results to everyone once the facilitator closes the health check', function () {
    [$retro, , $alice, $bob, $aliceParticipant] = healthCheckBoard([], RetroPhase::Discussing);
    answerHealthCheck($retro, $aliceParticipant, healthCheckScores(4));
    $confirm = '[role="alertdialog"] button:has-text("Close the health check")';
    $results = healthCheckDialog().' [data-slot="health-check-compact"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSeeIn('[aria-current="step"]', 'Discussing')
        ->assertSeeIn(healthCheckButton(), '1/2');

    healthCheckScoreAll(healthCheckOpen($bobPage), [2, 2, 2, 2, 2, 2])
        ->click(healthCheckSubmit())
        ->assertSeeIn(healthCheckDialog(), 'Answers sent. Thank you.')
        ->assertSeeIn(healthCheckButton(), '2/2')
        ->assertNotPresent(healthCheckDialog().' button:has-text("Close the health check")');

    $alicePage->assertSeeIn(healthCheckButton(), '2/2');

    healthCheckOpen($alicePage)
        ->click(healthCheckDialog().' button:has-text("Close the health check")')
        ->assertSeeIn('[role="alertdialog"]', 'Everyone will see the results.')
        ->click($confirm)
        ->assertNotPresent('[role="alertdialog"]')
        ->assertSeeIn($results, '2 answers · avg 3.0')
        ->assertPresent(healthCheckDialog().' button:has-text("Reopen")');

    $bobPage->assertSeeIn($results, '2 answers · avg 3.0')
        ->assertNotPresent(healthCheckDialog().' [role="radiogroup"]')
        ->assertNotPresent(healthCheckDialog().' button:has-text("Reopen")');

    expect(healthCheckSurvey($retro)->status)->toBe(TeamSurveyStatus::Closed);

    $alicePage->click(healthCheckDialog().' button:has-text("Reopen")')
        ->assertNotPresent($results)
        ->assertSeeIn(healthCheckDialog(), 'Answers sent. Thank you.');

    $bobPage->assertNotPresent($results)
        ->assertSeeIn(healthCheckDialog(), 'Answers sent. Thank you.');

    expect(healthCheckSurvey($retro)->status)->toBe(TeamSurveyStatus::Open)
        ->and(TeamSurveyAnswer::query()->count())->toBe(12);
});

it('keeps the statements of a health check once it has answers, and brings them back when it is removed and added again', function () {
    [$retro, , $alice, , , $bobParticipant] = healthCheckBoard();
    answerHealthCheck($retro, $bobParticipant, healthCheckScores(3));
    $unanswered = Retro::factory()->inPhase(RetroPhase::Writing)->withHealthCheck()->create(['team_id' => $retro->team_id]);
    $olivia = workspaceManager($retro->team->workspace, WorkspaceRole::Owner);
    $olivia->update(['name' => 'Olivia Owner', 'locale' => 'en']);
    $frozenKeys = ['interaction', 'task_clarity', 'manager_support', 'vision', 'processes', 'motivation'];

    $teamPage = $this->signIn($olivia, route('teams.healthStatements.index', [$retro->team->workspace, $retro->team], false));

    $teamPage->assertVisible('[aria-label="Statement"]')
        ->fill('[aria-label="Statement"]', 'We shipped what we promised')
        ->fill('[aria-label="Short label"]', 'Delivery')
        ->click('button:has-text("Add statement")')
        ->assertSee('Statement added.')
        ->assertCount('li:has([aria-label="Drag to reorder"])', 7);

    expect($retro->team->healthStatements()->count())->toBe(7)
        ->and(healthCheckSurvey($retro)->questions()->pluck('match_key')->all())->toBe($frozenKeys)
        ->and(healthCheckSurvey($unanswered)->questions()->count())->toBe(7);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    healthCheckOpen($alicePage)
        ->assertScript(healthCheckDialogStatements(), healthCheckBuiltIns())
        ->click(healthCheckDialog().' button:has-text("Remove")')
        ->assertSeeIn('[role="alertdialog"]', 'Any answers it holds are kept and come back if you add it again.')
        ->click('[role="alertdialog"] button:has-text("Remove")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertNotPresent(healthCheckDialog())
        ->assertNotPresent(healthCheckButton());

    expect(healthCheckSurvey($retro)->status)->toBe(TeamSurveyStatus::Draft)
        ->and(TeamSurveyAnswer::query()->count())->toBe(6);

    openRetroSettings($alicePage)
        ->click('[role="dialog"] button:has-text("Add survey")')
        ->assertPresent('[role="menuitem"]:has-text("Health check")')
        ->click('[role="menuitem"]:has-text("Health check")')
        ->assertSeeIn(healthCheckButton(), '1/2');

    $alicePage->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]');

    healthCheckOpen($alicePage)
        ->assertScript(healthCheckDialogStatements(), healthCheckBuiltIns())
        ->assertDontSeeIn(healthCheckDialog(), 'We shipped what we promised');

    expect(healthCheckSurvey($retro)->status)->toBe(TeamSurveyStatus::Open)
        ->and(healthCheckSurvey($retro)->questions()->pluck('match_key')->all())->toBe($frozenKeys)
        ->and(TeamSurveyAnswer::query()->count())->toBe(6);
});
