<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Enums\HealthStatement;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Column;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamHealthStatement;
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
function p08bBoard(array $attributes = [], RetroPhase $phase = RetroPhase::HealthCheck): array
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

    resolve(FreezeHealthStatements::class)->handle($retro);

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $columns, $alice, $bob, $aliceParticipant, $bobParticipant];
}

function p08bAnswer(Retro $retro, Participant $participant, HealthStatement $statement, int $score): HealthCheckAnswer
{
    return HealthCheckAnswer::factory()->create([
        'retro_id' => $retro->id,
        'participant_id' => $participant->id,
        'statement' => $statement->value,
        'score' => $score,
    ]);
}

function p08bRow(string $statement): string
{
    return "ol > li:has([role=\"radiogroup\"][aria-label=\"{$statement}\"])";
}

function p08bScore(string $statement, int $score): string
{
    return "ol > li [role=\"radiogroup\"][aria-label=\"{$statement}\"] [aria-label=\"Score {$score}\"]";
}

function p08bChecked(): string
{
    return 'ol > li [role="radio"][aria-checked="true"]';
}

function p08bBuiltIns(): string
{
    return implode(' | ', [
        'Interaction with colleagues was productive',
        'Tasks assigned to me were clear',
        'My manager was understanding and supportive',
        'The vision and goals are clear to me',
        'Our processes let me work without blockers',
        'I felt motivated in my work',
    ]);
}

function p08bTeamStatements(): string
{
    return "[...[...document.querySelectorAll('section')].find((section) => section.querySelector('h2')?.textContent === 'Health check statements').querySelectorAll('ol > li')].map((row) => row.querySelector('div > div').textContent).join(' | ')";
}

function p08bBoardStatements(): string
{
    return "[...document.querySelectorAll('ol > li > [role=\"radiogroup\"]')].map((group) => group.getAttribute('aria-label')).join(' | ')";
}

/**
 * @return array{
 *     keys: string,
 *     fields: string,
 *     myScores: array<int, ?int>,
 *     counts: array<int, int>,
 *     answeredBy: array<int, string>
 * }
 */
function p08bHealthSnapshot(mixed $page, Retro $retro): array
{
    $json = $page->script("() => fetch('/retros/{$retro->id}/snapshot', { headers: { Accept: 'application/json' } }).then((response) => response.json()).then((snapshot) => JSON.stringify({ keys: Object.keys(snapshot.healthCheck).join(','), fields: [...new Set(snapshot.healthCheck.statements.flatMap((statement) => Object.keys(statement)))].sort().join(','), myScores: snapshot.healthCheck.statements.map((statement) => statement.myScore), counts: snapshot.healthCheck.statements.map((statement) => statement.count), answeredBy: snapshot.healthCheck.statements[0].answeredBy }))");

    return json_decode((string) $json, true, flags: JSON_THROW_ON_ERROR);
}

function p08bOpenSettings(mixed $page): mixed
{
    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSeeIn('[role="dialog"]', 'Retrospective settings')
        ->assertNotPresent('[role="menu"]');

    return $page;
}

it('[P08b-01a] lets an Owner add, archive, reorder, reword and restore the health check statements of a team', function () {
    $team = Team::factory()->create();
    $olivia = workspaceManager($team->workspace, WorkspaceRole::Owner);
    $olivia->update(['name' => 'Olivia Owner', 'locale' => 'en']);
    $active = 'li:has([aria-label="Drag to reorder"])';
    $manager = 'li:has-text("My manager was understanding and supportive")';
    $custom = 'li:has-text("We shipped what we promised")';
    $editing = 'li:has(input[aria-label="Statement"])';
    $handle = 'li:has-text("Interaction with colleagues was productive") [aria-label="Drag to reorder"]';
    $archivedToggle = 'button:has-text("Archived (1)")';
    $announcement = "document.querySelector('[id^=\"DndLiveRegion\"]').textContent";

    $page = $this->signIn($olivia, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('Health check statements')
        ->assertSee('Changes apply to retros that have not collected answers yet.')
        ->assertCount($active, 6)
        ->assertScript(p08bTeamStatements(), p08bBuiltIns())
        ->assertNotPresent("{$manager} button:has-text(\"Edit\")");

    $page->fill('[aria-label="Statement"]', 'We shipped what we promised')
        ->fill('[aria-label="Axis label"]', 'Delivery')
        ->click('button:has-text("Add statement")')
        ->assertSee('Statement added.')
        ->assertCount($active, 7)
        ->assertSeeIn($custom, 'Delivery')
        ->assertPresent("{$custom} button:has-text(\"Edit\")");

    $page->click("{$manager} button:has-text(\"Archive\")")
        ->assertPresent($archivedToggle)
        ->assertCount($active, 6);

    $page->keys($handle, 'Space')
        ->assertAttribute($handle, 'aria-pressed', 'true');
    $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 0))');
    $page->keys($handle, 'ArrowDown')
        ->assertScript($announcement, 'Moved Interaction to position 2.')
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
        ->assertVisible('button:has-text("Restore")')
        ->click('button:has-text("Restore")')
        ->assertCount($active, 7)
        ->assertNotPresent($archivedToggle)
        ->assertPresent("{$manager} button:has-text(\"Archive\")")
        ->click("{$manager} button:has-text(\"Archive\")")
        ->assertPresent($archivedToggle)
        ->assertCount($active, 6);

    $statements = $team->healthStatements()->get();

    expect($statements)->toHaveCount(7)
        ->and($statements->firstWhere('builtin', HealthStatement::ManagerSupport)->archived_at)->not->toBeNull()
        ->and($statements->whereNull('builtin')->sole()->text)->toBe('We delivered what we promised')
        ->and($statements->whereNull('builtin')->sole()->label)->toBe('Delivery')
        ->and($statements->whereNull('archived_at')->first()->builtin)->toBe(HealthStatement::TaskClarity);
});

it('[P08b-01b] shows the health check statements to a plain member as a read-only list', function () {
    $team = Team::factory()->create();
    $bob = teamMember($team);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    $page = $this->signIn($bob, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('Health check statements')
        ->assertSee('Changes apply to retros that have not collected answers yet.')
        ->assertScript(p08bTeamStatements(), p08bBuiltIns())
        ->assertNotPresent('[aria-label="Drag to reorder"]')
        ->assertNotPresent('[aria-label="Statement"]')
        ->assertNotPresent('button:has-text("Add statement")')
        ->assertNotPresent('button:has-text("Archive")')
        ->assertNotPresent('button:has-text("Restore")');

    expect($team->healthStatements()->count())->toBe(0);
});

it('[P08b-02] starts a retro on the Health check with the active statements of the team in their order', function () {
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
    $phaseOrder = "[...document.querySelectorAll('header ol[aria-label=\"Phases\"] li')].map((step) => step.textContent).join(' > ')";

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 15 retro')
        ->assertCount('[role="dialog"] li button[aria-pressed="true"]', 1)
        ->click('[role="dialog"] button:has-text("Settings")')
        ->assertVisible('#new-retro-health-check')
        ->click('#new-retro-health-check')
        ->assertAttribute('#new-retro-health-check', 'aria-checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Sprint 15 retro')
        ->assertSeeIn('[aria-current="step"]', 'Health check')
        ->assertScript($phaseOrder, 'Health check > Writing > Grouping > Voting > Discussing > Completed')
        ->assertSee('Rate each statement from 1 (Awful) to 10 (Great). Only you see your own scores.')
        ->assertScript(p08bBoardStatements(), implode(' | ', [
            'The vision and goals are clear to me',
            'We shipped what we promised',
            'I felt motivated in my work',
            'Interaction with colleagues was productive',
        ]))
        ->assertDontSee('My manager was understanding and supportive');

    $retro = Retro::query()->where('title', 'Sprint 15 retro')->firstOrFail();

    expect($retro->phase)->toBe(RetroPhase::HealthCheck)
        ->and($retro->health_check_enabled)->toBeTrue()
        ->and($retro->healthStatements->pluck('key')->all())->toBe(['vision', $custom->id, 'motivation', 'interaction']);
});

it('[P08b-03a] shows who answered and how many, and never a score of someone else', function () {
    [$retro, , $alice, , $aliceParticipant] = p08bBoard();
    $interaction = 'Interaction with colleagues was productive';
    $row = p08bRow($interaction);
    $fields = 'answeredBy,count,isBuiltin,key,label,myScore,text';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertSeeIn('[aria-current="step"]', 'Health check')
        ->assertSeeIn($row, '0 answered');

    $alicePage->click(p08bScore($interaction, 7))
        ->assertAttribute(p08bScore($interaction, 7), 'aria-checked', 'true')
        ->assertSeeIn($row, '1 answered')
        ->assertPresent("{$row} img[alt=\"Alice Martin\"]")
        ->assertPresent("{$row} [aria-label=\"Answered\"]");

    $carolPage->assertSeeIn($row, '1 answered')
        ->assertPresent("{$row} img[alt=\"Alice Martin\"]")
        ->assertNotPresent(p08bChecked())
        ->assertNotPresent('[aria-label="Answered"]')
        ->assertNotPresent("{$row} button:has-text(\"Clear\")");

    $carolView = p08bHealthSnapshot($carolPage, $retro);

    expect($carolView['keys'])->toBe('statements')
        ->and($carolView['fields'])->toBe($fields)
        ->and($carolView['myScores'])->toBe([null, null, null, null, null, null])
        ->and($carolView['counts'])->toBe([1, 0, 0, 0, 0, 0])
        ->and($carolView['answeredBy'])->toBe([$aliceParticipant->id]);

    $carolPage->click(p08bScore($interaction, 3))
        ->assertAttribute(p08bScore($interaction, 3), 'aria-checked', 'true')
        ->assertAttribute(p08bScore($interaction, 7), 'aria-checked', 'false')
        ->assertCount(p08bChecked(), 1)
        ->assertSeeIn($row, '2 answered');

    $alicePage->assertSeeIn($row, '2 answered')
        ->assertPresent("{$row} img[alt=\"Carol Guest\"]")
        ->assertAttribute(p08bScore($interaction, 7), 'aria-checked', 'true')
        ->assertAttribute(p08bScore($interaction, 3), 'aria-checked', 'false')
        ->assertCount(p08bChecked(), 1);

    $aliceView = p08bHealthSnapshot($alicePage, $retro);

    expect($aliceView['fields'])->toBe($fields)
        ->and($aliceView['myScores'])->toBe([7, null, null, null, null, null])
        ->and($aliceView['counts'])->toBe([2, 0, 0, 0, 0, 0])
        ->and($aliceView['answeredBy'])->toHaveCount(2)
        ->and($retro->healthCheckAnswers()->orderBy('score')->pluck('score')->all())->toBe([3, 7]);
});

it('[P08b-03b] removes the own answer with Clear', function () {
    [$retro, , $alice, $bob, $aliceParticipant, $bobParticipant] = p08bBoard();
    p08bAnswer($retro, $aliceParticipant, HealthStatement::Interaction, 8);
    p08bAnswer($retro, $bobParticipant, HealthStatement::Interaction, 5);
    $interaction = 'Interaction with colleagues was productive';
    $row = p08bRow($interaction);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertSeeIn($row, '2 answered');

    $bobPage->assertAttribute(p08bScore($interaction, 5), 'aria-checked', 'true')
        ->assertSeeIn($row, '2 answered')
        ->click("{$row} button:has-text(\"Clear\")")
        ->assertNotPresent(p08bChecked())
        ->assertSeeIn($row, '1 answered')
        ->assertNotPresent("{$row} img[alt=\"Bob Stone\"]")
        ->assertNotPresent("{$row} button:has-text(\"Clear\")");

    $alicePage->assertSeeIn($row, '1 answered')
        ->assertNotPresent("{$row} img[alt=\"Bob Stone\"]")
        ->assertAttribute(p08bScore($interaction, 8), 'aria-checked', 'true');

    expect($retro->healthCheckAnswers()->where('participant_id', $bobParticipant->id)->exists())->toBeFalse()
        ->and($retro->healthCheckAnswers()->where('participant_id', $aliceParticipant->id)->value('score'))->toBe(8);
});

it('[P08b-03c] wraps the ten score buttons to two rows of five on a narrow window', function () {
    [$retro, , , $bob] = p08bBoard();
    $rows = "(() => { const tops = [...document.querySelectorAll('ol > li [role=\"radiogroup\"][aria-label=\"Interaction with colleagues was productive\"] [role=\"radio\"]')].map((button) => Math.round(button.getBoundingClientRect().top)); return [...new Set(tops)].map((top) => tops.filter((value) => value === top).length).join(','); })()";

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->assertSeeIn('[aria-current="step"]', 'Health check')
        ->assertScript($rows, '10')
        ->resize(375, 812)
        ->assertScript($rows, '5,5')
        ->resize(1280, 800)
        ->assertScript($rows, '10');
});

it('[P08b-04] shows counts only and no avatar on an anonymous retro', function () {
    [$retro, , $alice, $bob] = p08bBoard(['is_anonymous' => true]);
    $interaction = 'Interaction with colleagues was productive';
    $row = p08bRow($interaction);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->click(p08bScore($interaction, 7))
        ->assertAttribute(p08bScore($interaction, 7), 'aria-checked', 'true')
        ->assertSeeIn($row, '1 answered')
        ->assertNotPresent('ol > li:has([role="radiogroup"]) img');

    $bobPage->assertSeeIn($row, '1 answered')
        ->assertNotPresent('ol > li:has([role="radiogroup"]) img')
        ->assertNotPresent(p08bChecked());

    $bobView = p08bHealthSnapshot($bobPage, $retro);

    expect($bobView['counts'])->toBe([1, 0, 0, 0, 0, 0])
        ->and($bobView['answeredBy'])->toBeEmpty()
        ->and($bobView['myScores'])->toBe([null, null, null, null, null, null]);
});

it('[P08b-05a] disables the score buttons for everyone when the board is closed for editing', function () {
    [$retro, , $alice, $bob] = p08bBoard();
    $interaction = 'Interaction with colleagues was productive';
    $disabled = "document.querySelectorAll('ol > li [role=\"radio\"]:disabled').length";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertEnabled(p08bScore($interaction, 7))
        ->assertScript($disabled, 0);

    p08bOpenSettings($alicePage)
        ->click('#retro-locked')
        ->assertAttribute('#retro-locked', 'aria-checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Board closed for editing')
        ->assertScript($disabled, 60);

    $bobPage->assertSee('Board closed for editing')
        ->assertDisabled(p08bScore($interaction, 7))
        ->assertScript($disabled, 60);

    expect($retro->fresh()->is_locked)->toBeTrue()
        ->and($retro->healthCheckAnswers()->count())->toBe(0);
});

it('[P08b-05b] shows the refusal and resyncs when an answer is sent to a board closed for editing', function () {
    [$retro, , , $bob] = p08bBoard();
    $interaction = 'Interaction with colleagues was productive';

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertEnabled(p08bScore($interaction, 7));

    $retro->update(['is_locked' => true]);

    $page->click(p08bScore($interaction, 7))
        ->assertSee('The board is closed for editing.')
        ->assertSee('Board closed for editing')
        ->assertDisabled(p08bScore($interaction, 7))
        ->assertNotPresent(p08bChecked())
        ->assertSeeIn(p08bRow($interaction), '0 answered');

    expect($retro->healthCheckAnswers()->count())->toBe(0);
});

it('[P08b-06] refuses an answer once the retro is in Writing and accepts it again back in the Health check', function () {
    [$retro, , $alice, $bob, , $bobParticipant] = p08bBoard();
    $interaction = 'Interaction with colleagues was productive';
    $current = '[aria-current="step"]';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertEnabled(p08bScore($interaction, 7));

    $retro->update(['phase' => RetroPhase::Writing]);

    $bobPage->click(p08bScore($interaction, 7))
        ->assertSee('This action is not available in the current phase.')
        ->assertSeeIn($current, 'Writing')
        ->assertNotPresent('ol > li [role="radiogroup"]')
        ->assertCount('[aria-label="Add a card…"]', 3);

    expect($retro->healthCheckAnswers()->count())->toBe(0);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $alicePage->assertSeeIn($current, 'Writing')
        ->click('header button:has-text("Previous")')
        ->assertSeeIn($current, 'Health check');

    $bobPage->assertSeeIn($current, 'Health check')
        ->click(p08bScore($interaction, 7))
        ->assertAttribute(p08bScore($interaction, 7), 'aria-checked', 'true')
        ->assertSeeIn(p08bRow($interaction), '1 answered');

    $alicePage->assertSeeIn(p08bRow($interaction), '1 answered');

    expect($retro->healthCheckAnswers()->where('participant_id', $bobParticipant->id)->value('score'))->toBe(7);
});

it('[P08b-07] keeps the statements a retro froze once it has answers', function () {
    [$retro, , $alice, , , $bobParticipant] = p08bBoard([], RetroPhase::Writing);
    p08bAnswer($retro, $bobParticipant, HealthStatement::Interaction, 6);
    $olivia = workspaceManager($retro->team->workspace, WorkspaceRole::Owner);
    $olivia->update(['name' => 'Olivia Owner', 'locale' => 'en']);
    $interaction = 'Interaction with colleagues was productive';
    $stepper = 'header ol[aria-label="Phases"]';
    $frozenKeys = ['interaction', 'task_clarity', 'manager_support', 'vision', 'processes', 'motivation'];

    $teamPage = $this->signIn($olivia, route('teams.show', [$retro->team->workspace, $retro->team], false));

    $teamPage->assertVisible('[aria-label="Statement"]')
        ->fill('[aria-label="Statement"]', 'We shipped what we promised')
        ->fill('[aria-label="Axis label"]', 'Delivery')
        ->click('button:has-text("Add statement")')
        ->assertSee('Statement added.')
        ->assertCount('li:has([aria-label="Drag to reorder"])', 7);

    expect($retro->team->healthStatements()->count())->toBe(7)
        ->and($retro->healthStatements()->pluck('key')->all())->toBe($frozenKeys);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $alicePage->assertSeeIn($stepper, 'Health check');

    p08bOpenSettings($alicePage)
        ->assertAttribute('#retro-health-check', 'aria-checked', 'true')
        ->click('#retro-health-check')
        ->assertAttribute('#retro-health-check', 'aria-checked', 'false')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertDontSeeIn($stepper, 'Health check');

    expect($retro->fresh()->health_check_enabled)->toBeFalse();

    p08bOpenSettings($alicePage)
        ->click('#retro-health-check')
        ->assertAttribute('#retro-health-check', 'aria-checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($stepper, 'Health check')
        ->click('header button:has-text("Previous")')
        ->assertSeeIn('[aria-current="step"]', 'Health check')
        ->assertScript(p08bBoardStatements(), p08bBuiltIns())
        ->assertDontSee('We shipped what we promised')
        ->assertSeeIn(p08bRow($interaction), '1 answered')
        ->assertPresent(p08bRow($interaction).' img[alt="Bob Stone"]');

    expect($retro->fresh()->health_check_enabled)->toBeTrue()
        ->and($retro->healthStatements()->pluck('key')->all())->toBe($frozenKeys)
        ->and($retro->healthCheckAnswers()->count())->toBe(1);
});
