<?php

use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Enums\TemplateCategory;
use App\Enums\WorkspaceRole;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;

function p08aMember(Team $team, string $name = 'Alice Martin'): User
{
    $user = teamMember($team);

    $user->update(['name' => $name, 'locale' => 'en']);

    return $user;
}

function p08aOwner(Team $team, string $name = 'Olivia Owner'): User
{
    $user = workspaceManager($team->workspace, WorkspaceRole::Owner);

    $user->update(['name' => $name, 'locale' => 'en']);

    return $user;
}

function p08aTeamPath(Team $team): string
{
    return route('teams.show', [$team->workspace, $team], false);
}

function p08aTemplate(Workspace $workspace): WorkspaceTemplate
{
    $template = WorkspaceTemplate::factory()->create([
        'workspace_id' => $workspace->id,
        'name' => 'Team pulse',
        'category' => TemplateCategory::TeamMood,
    ]);

    $columns = [
        ['Energy', 'How much energy the sprint left us', ColumnColor::Moss],
        ['Blockers', 'What kept slowing us down', ColumnColor::Coral],
    ];

    foreach ($columns as $position => [$title, $description, $color]) {
        WorkspaceTemplateColumn::factory()->create([
            'workspace_template_id' => $template->id,
            'title' => $title,
            'description' => $description,
            'color' => $color,
            'position' => $position,
        ]);
    }

    return $template->fresh();
}

function p08aPhaseOrder(): string
{
    return "[...document.querySelectorAll('header ol[aria-label=\"Phases\"] [data-slot=\"phase-step\"]')].map((step) => step.querySelector('.truncate').textContent).join(' > ')";
}

/**
 * @param  array<string, mixed>  $snapshot
 * @return array<string, array{
 *     hidden: bool,
 *     content: ?string,
 *     author: ?string
 * }>
 */
function p08aCardsSent(array $snapshot): array
{
    return collect($snapshot['cards'])
        ->sortByDesc('isMine')
        ->mapWithKeys(fn (array $card): array => [$card['isMine'] ? 'mine' : 'other' => [
            'hidden' => $card['hidden'],
            'content' => $card['content'],
            'author' => $card['author']['name'] ?? null,
        ]])
        ->all();
}

function p08aColumnTitles(): string
{
    return "[...document.querySelectorAll('[data-test^=\"retro-column-\"] h3')].map((title) => title.textContent).join(' | ')";
}

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
function p08aBoard(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withIcebreaker()
        ->withGuestAccess()
        ->create(['title' => 'Sprint 14', ...$attributes]);

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

function p08aCard(Retro $retro, Column $column, Participant $author, string $content, int $position = 0): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'position' => $position,
    ]);
}

function p08aColumn(Column $column): string
{
    return "[data-test=\"retro-column-{$column->id}\"]";
}

function p08aOpenSettings(mixed $page): mixed
{
    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSeeIn('[role="dialog"]', 'Retrospective settings')
        ->assertNotPresent('[role="menu"]');

    return $page;
}

it('[P08a-01a] prefills the title and filters the template catalogue by search and by category', function () {
    $team = Team::factory()->create();
    $alice = p08aMember($team);
    $picker = '[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"]';
    $templates = "{$picker} [role=\"radio\"]:not([data-template-id=\"custom\"])";
    $blank = "{$picker} [role=\"radio\"][data-template-id=\"custom\"]";
    $all = '[role="dialog"] [aria-label="Category"] button:first-child';
    $themed = '[role="dialog"] [aria-label="Category"] button:has-text("Themed & fun")';
    $search = '[aria-label="Search templates"]';
    $preview = '[role="dialog"] section[aria-label="Template preview"]';
    $prefilledTitle = "document.querySelector('#new-retro-title').value === 'Retro ' + new Date().toLocaleDateString('en', { dateStyle: 'medium' })";
    $swatches = "[...document.querySelectorAll('[role=\"dialog\"] section[aria-label=\"Template preview\"] [data-slot=\"template-mini-board\"] > li')].map((column) => [...column.classList].find((name) => name.startsWith('col-'))).join(',')";

    $page = $this->signIn($alice, p08aTeamPath($team));

    $page->assertSee('New session')
        ->click('New session')
        ->assertVisible('#new-retro-title')
        ->assertScript($prefilledTitle, true)
        ->assertCount("{$picker} [role=\"radio\"]", 5)
        ->click('Browse')
        ->assertCount($templates, 52)
        ->assertCount($blank, 1)
        ->assertSeeIn($blank, 'Start from scratch')
        ->assertAttribute($all, 'aria-pressed', 'true');

    $page->fill($search, 'sail')
        ->assertCount($templates, 1)
        ->assertSeeIn($templates, 'Sailboat')
        ->click($templates)
        ->assertAttribute($templates, 'aria-checked', 'true')
        ->assertSeeIn($preview, 'Sailboat')
        ->assertSeeIn($preview, 'Themed & fun')
        ->assertCount("{$preview} [data-slot=\"template-mini-board\"] > li", 4)
        ->assertSeeIn($preview, 'What anchors are holding us back?')
        ->assertSeeIn($preview, 'What slows us down and adds drag every sprint')
        ->assertSeeIn($preview, 'What is our ideal island destination?')
        ->assertScript($swatches, 'col-moss,col-coral,col-sun,col-sky');

    $page->fill($search, 'no such template')
        ->assertSeeIn('[role="dialog"]', 'No template matches "no such template"')
        ->assertNotPresent($templates)
        ->fill($search, '')
        ->assertCount($templates, 52);

    $page->click($themed)
        ->assertAttribute($themed, 'aria-pressed', 'true')
        ->assertAttribute($all, 'aria-pressed', 'false')
        ->assertCount($templates, 9)
        ->assertCount("{$templates}:has-text(\"Sailboat\")", 1)
        ->assertCount($blank, 1)
        ->assertNotPresent("{$templates}:has-text(\"Start, Stop, Continue\")")
        ->click($all)
        ->assertCount($templates, 52)
        ->click($blank)
        ->assertSeeIn($preview, 'Start from scratch')
        ->assertSeeIn($preview, 'An empty board: add your own columns.');

    expect(Retro::query()->count())->toBe(0);
});

it('[P08a-01b] starts a retro in the Icebreaker phase with the automatic vote limit from the creation dialog', function () {
    $team = Team::factory()->create();
    $alice = p08aMember($team);
    $templates = '[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"]:not([data-template-id="custom"])';

    $page = $this->signIn($alice, p08aTeamPath($team));

    $page->assertSee('New session')
        ->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 14 retro')
        ->click('Browse')
        ->fill('[aria-label="Search templates"]', 'sail')
        ->assertCount($templates, 1)
        ->click($templates)
        ->assertAttribute($templates, 'aria-checked', 'true')
        ->assertVisible('#new-retro-icebreaker')
        ->assertAttribute('#new-retro-icebreaker', 'aria-checked', 'false')
        ->assertAttribute('#new-retro-health-check', 'aria-checked', 'false')
        ->assertAttribute('#new-retro-votes-auto', 'aria-checked', 'true')
        ->assertSeeIn('[role="dialog"]', 'Automatic: number of cards plus 3, at most 10.')
        ->click('#new-retro-icebreaker')
        ->assertAttribute('#new-retro-icebreaker', 'aria-checked', 'true')
        ->assertVisible('#new-retro-icebreaker-game')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header >> h1', 'Sprint 14 retro')
        ->assertSeeIn('[aria-current="step"]', 'Icebreaker')
        ->assertScript(p08aPhaseOrder(), 'Icebreaker > Writing > Grouping > Voting > Discussing > Actions > ROTI')
        ->assertPresent('section[aria-label="Icebreaker game"]')
        ->assertPresent('[aria-label="Facilitator menu"]');

    $retro = Retro::query()->where('title', 'Sprint 14 retro')->firstOrFail();

    expect($retro->template)->toBe('sailboat')
        ->and($retro->phase)->toBe(RetroPhase::Icebreaker)
        ->and($retro->icebreaker_enabled)->toBeTrue()
        ->and($retro->health_check_enabled)->toBeFalse()
        ->and($retro->votes_per_participant)->toBeNull()
        ->and($retro->facilitator->user_id)->toBe($alice->id)
        ->and($retro->columns->pluck('title')->all())->toBe([
            'What is the wind pushing our sails that makes us go fast?',
            'What anchors are holding us back?',
            'What rocks are ahead of us that risk our future?',
            'What is our ideal island destination?',
        ])
        ->and($retro->columns->pluck('description')->all())->toBe([
            'What pushed us forward and we could repeat on purpose',
            'What slows us down and adds drag every sprint',
            'Risks ahead that will hurt us if nothing changes',
            'The goal we are sailing to — agree on this before the rest',
        ]);
});

it('[P08a-07a] shows the workspace templates to a member as cards without edit buttons, lets the member create or duplicate one, and lists them in the full picker', function () {
    $team = Team::factory()->create();
    $alice = p08aMember($team);
    $template = p08aTemplate($team->workspace);
    $card = '[data-test="workspace-template-'.$template->id.'"]';
    $radio = '[data-slot="retro-template-picker"] [role="radio"]:has-text("Team pulse")';
    $preview = 'section[aria-label="Template preview"]';

    $page = $this->signIn($alice, p08aTeamPath($team));

    $page->assertPresent('a[href$="/templates"]')
        ->click('a[href$="/templates"]')
        ->assertPathIs("/w/{$team->workspace->slug}/templates")
        ->assertSee('Templates shared by every team of this workspace')
        ->assertSeeIn($card, 'Team pulse')
        ->assertSeeIn($card, 'Energy')
        ->assertSeeIn($card, 'Blockers')
        ->assertSeeIn($card, '2 columns · used 0×')
        ->assertPresent("{$card} a:has-text(\"Use\")")
        ->assertNotPresent("{$card} button")
        ->assertPresent('button:has-text("New template")')
        ->click('[role="tab"]:has-text("Retro")')
        ->click('[data-slot="retro-template-picker"] [role="tab"]:has-text("My workspace")')
        ->click($radio)
        ->assertAttribute($radio, 'aria-checked', 'true')
        ->assertSeeIn($preview, 'Team & mood')
        ->assertSeeIn($preview, 'How much energy the sprint left us')
        ->assertPresent("{$preview} button:has-text(\"Use this template\")")
        ->assertNotPresent("{$preview} button:text-is(\"Edit\")")
        ->assertPresent("{$preview} button:has-text(\"Duplicate and edit\")");

    expect(WorkspaceTemplate::query()->count())->toBe(1);
});

it('[P08a-07b] lets an Owner create a workspace template from a built-in one', function () {
    $team = Team::factory()->create();
    $olivia = p08aOwner($team);
    $card = '[data-slot="template-card"]:has(h3:text-is("Team pulse"))';
    $titles = "[...document.querySelectorAll('[role=\"dialog\"] input[aria-label^=\"Column \"][aria-label$=\" title\"]')].map((input) => input.value).join(' | ')";
    $firstHandle = '[role="dialog"] button[aria-label^="Reorder “Start”"]';

    $page = $this->signIn($olivia, "/w/{$team->workspace->slug}/templates");

    $page->assertSee('No workspace templates yet.')
        ->click('button:has-text("New template")')
        ->assertVisible('#template-name')
        ->assertVisible('#template-source')
        ->click('#template-source')
        ->assertPresent('[role="listbox"]')
        ->click('[role="option"]:has-text("Start, Stop, Continue")')
        ->assertNotPresent('[role="listbox"]')
        ->assertValue('#template-name', 'Start, Stop, Continue')
        ->assertValue('[role="dialog"] [aria-label="Column 1 title"]', 'Start')
        ->assertScript($titles, 'Start | Stop | Continue');

    $page->fill('#template-name', 'Team pulse')
        ->click('#template-category')
        ->assertPresent('[role="listbox"]')
        ->click('[role="option"]:has-text("Team & mood")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('#template-category', 'Team & mood');

    $this->dragWithKeyboard($page, $firstHandle, ['Space', 'ArrowDown', 'Space']);

    $page->assertScript($titles, 'Stop | Start | Continue')
        ->assertPresent('[role="dialog"] button:has-text("Add a column")')
        ->click('[role="dialog"] [aria-label="Delete column “Continue”"]')
        ->assertScript($titles, 'Stop | Start')
        ->assertPresent('[role="dialog"] button[type="submit"]')
        ->keys('#template-name', 'Enter')
        ->assertSee('Template saved.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($card, 'Stop')
        ->assertSeeIn($card, 'Start')
        ->assertDontSeeIn($card, 'Continue')
        ->assertSeeIn($card, 'By Olivia Owner')
        ->click("{$card} [data-slot=\"template-card-menu\"]")
        ->assertPresent('[role="menuitem"]:has-text("Edit")')
        ->assertPresent('[role="menuitem"]:has-text("Duplicate")')
        ->assertPresent('[role="menuitem"]:has-text("Delete")');

    $template = WorkspaceTemplate::query()->where('name', 'Team pulse')->firstOrFail();

    expect($template->workspace_id)->toBe($team->workspace_id)
        ->and($template->category)->toBe(TemplateCategory::TeamMood)
        ->and($template->created_by_user_id)->toBe($olivia->id)
        ->and($template->columns->pluck('title')->all())->toBe(['Stop', 'Start'])
        ->and($template->columns->pluck('description')->all())->toBe([
            'Habits that get in the way and should end now',
            'New practices worth trying in the next cycle',
        ]);
});

it('[P08a-07c] starts a retro from a workspace template found under its category', function () {
    $team = Team::factory()->create();
    $alice = p08aMember($team);
    $template = p08aTemplate($team->workspace);
    $templates = '[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"]:not([data-template-id="custom"])';
    $preview = '[role="dialog"] section[aria-label="Template preview"]';

    $page = $this->signIn($alice, p08aTeamPath($team));

    $page->assertSee('New session')
        ->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Pulse check')
        ->click('Browse')
        ->assertCount($templates, 52)
        ->click('[role="dialog"] [aria-label="Category"] button:has-text("Team & mood")')
        ->assertCount($templates, 8)
        ->click('[role="dialog"] [role="tab"]:has-text("My workspace")')
        ->assertCount($templates, 1)
        ->click("{$templates}:has-text(\"Team pulse\")")
        ->assertAttribute("{$templates}:has-text(\"Team pulse\")", 'aria-checked', 'true')
        ->assertSeeIn($preview, 'Team pulse')
        ->assertSeeIn($preview, 'How much energy the sprint left us')
        ->assertSeeIn($preview, 'What kept slowing us down')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header >> h1', 'Pulse check')
        ->assertCount('[data-test^="retro-column-"]', 2)
        ->assertScript(p08aColumnTitles(), 'Energy | Blockers')
        ->assertSee('How much energy the sprint left us')
        ->assertSee('What kept slowing us down');

    $retro = Retro::query()->where('title', 'Pulse check')->firstOrFail();

    expect($retro->template)->toBe('workspace')
        ->and($retro->workspace_template_id)->toBe($template->id)
        ->and($retro->phase)->toBe(RetroPhase::Writing)
        ->and($retro->columns->pluck('title')->all())->toBe(['Energy', 'Blockers'])
        ->and($retro->columns->pluck('description')->all())->toBe([
            'How much energy the sprint left us',
            'What kept slowing us down',
        ]);
});

it('[P08a-07d] keeps the columns of a retro when its workspace template is deleted', function () {
    $team = Team::factory()->create();
    $olivia = p08aOwner($team);
    $template = p08aTemplate($team->workspace);
    $retro = Retro::factory()->create([
        'team_id' => $team->id,
        'title' => 'Pulse check',
        'template' => 'workspace',
        'workspace_template_id' => $template->id,
    ]);

    foreach (['Energy', 'Blockers'] as $position => $title) {
        Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    retroFacilitator($retro);
    $card = '[data-test="workspace-template-'.$template->id.'"]';

    $page = $this->signIn($olivia, "/w/{$team->workspace->slug}/templates");

    $page->assertSeeIn($card, 'Energy')
        ->assertSeeIn($card, '2 columns · used 1×')
        ->click("{$card} [data-slot=\"template-card-menu\"]")
        ->click('[role="menuitem"]:has-text("Edit")')
        ->assertValue('#template-name', 'Team pulse')
        ->click('[role="dialog"] button:has-text("Delete template")')
        ->assertSeeIn('[role="alertdialog"]', 'Delete this template?')
        ->assertSeeIn('[role="alertdialog"]', 'Retros already created from it are not affected.')
        ->click('[role="alertdialog"] button:has-text("Delete template")')
        ->assertSee('Template deleted.')
        ->assertSee('No workspace templates yet.')
        ->assertNotPresent('[role="dialog"]')
        ->navigate("/retros/{$retro->id}")
        ->assertSeeIn('header >> h1', 'Pulse check')
        ->assertCount('[data-test^="retro-column-"]', 2)
        ->assertScript(p08aColumnTitles(), 'Energy | Blockers');

    expect(WorkspaceTemplate::query()->whereKey($template->id)->exists())->toBeFalse()
        ->and($retro->fresh()->workspace_template_id)->toBeNull()
        ->and($retro->fresh()->template)->toBe('workspace')
        ->and($retro->columns()->count())->toBe(2);
});

it('[P08a-02a] shows the Icebreaker phase with its game and the shared timer to the facilitator and a guest', function () {
    [$retro, , $alice] = p08aBoard(RetroPhase::Icebreaker);
    config(['queue.default' => 'database']);
    $stage = 'section[aria-label="Icebreaker game"]';
    $isCountingDown = "/^(1:00|0:[3-5]\\d)$/.test(document.querySelector('[role=\"timer\"]').innerText.trim())";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Icebreaker')
            ->assertScript(p08aPhaseOrder(), 'Icebreaker > Writing > Grouping > Voting > Discussing > Actions > ROTI')
            ->assertPresent($stage)
            ->assertNotPresent('[data-test^="retro-column-"]')
            ->assertNotPresent('[role="timer"]');
    }

    $alicePage->assertSeeIn($stage, 'Draw & Guess')
        ->assertPresent("{$stage} button:has-text(\"Choose a game\")")
        ->assertPresent('header button:has-text("Next")')
        ->assertPresent('header button[aria-disabled="true"]:has-text("Previous")');
    $carolPage->assertSeeIn($stage, 'Draw & Guess')
        ->assertNotPresent("{$stage} button:has-text(\"Choose a game\")")
        ->assertNotPresent('header button:has-text("Next")');

    $alicePage->click('[aria-label="Timer"]')
        ->assertPresent('[role="menu"]')
        ->click('[role="menuitem"]:has-text("1 min")')
        ->assertNotPresent('[role="menu"]');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertPresent('[role="timer"]')->assertScript($isCountingDown, true);
    }

    expect($retro->fresh()->timer_ends_at)->not->toBeNull()
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Icebreaker);
});

it('[P08a-02b] shows a column and its description added by the facilitator to a guest', function () {
    [$retro, , $alice] = p08aBoard();
    $columns = '[data-test^="retro-column-"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertCount($columns, 3)
        ->assertNotPresent('input[aria-label="Column title"]');

    $alicePage->assertVisible('input[aria-label="Column title"]')
        ->fill('input[aria-label="Column title"]', 'Kudos')
        ->click('button:has-text("Add column")')
        ->assertCount($columns, 4);

    $column = Column::query()->where('retro_id', $retro->id)->where('title', 'Kudos')->firstOrFail();
    $kudos = p08aColumn($column);

    $carolPage->assertCount($columns, 4)
        ->assertSeeIn("{$kudos} h3", 'Kudos');

    $alicePage->click("{$kudos} [aria-label=\"Column menu\"]")
        ->assertPresent('[role="menu"]')
        ->click('[role="menuitem"]:has-text("Edit description")')
        ->assertSeeIn('[role="dialog"]', 'Column description')
        ->fill('[role="dialog"] textarea', 'Thank a teammate for something specific')
        ->click('[role="dialog"] button:has-text("Save")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($kudos, 'Thank a teammate for something specific');

    $carolPage->assertSeeIn($kudos, 'Thank a teammate for something specific')
        ->assertNotPresent('[aria-label="Column menu"]');

    expect($column->fresh()->description)->toBe('Thank a teammate for something specific')
        ->and($column->fresh()->position)->toBe(3);
});

it('[P08a-03] hides the cards of others again each time the retro moves back to Writing or to Icebreaker', function () {
    [$retro, $columns, $alice] = p08aBoard(RetroPhase::Icebreaker);
    $start = p08aColumn($columns[0]);
    $composer = "{$start} [data-slot=\"retro-card-composer\"] textarea";
    $add = "{$start} [data-slot=\"retro-card-composer\"] button[type=\"submit\"]";
    $openComposer = "{$start} [data-slot=\"retro-column-add\"]";
    $next = 'header button:has-text("Next")';
    $previous = 'header button:has-text("Previous")';
    $current = '[aria-current="step"]';
    $stage = 'section[aria-label="Icebreaker game"]';
    $aliceCard = 'Ship smaller pull requests';
    $carolCard = 'Keep the demo on Fridays';
    $inDocument = fn (string $text): string => "document.documentElement.outerHTML.includes(\"{$text}\")";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertPresent($stage)
        ->click($next)
        ->assertSeeIn($current, 'Writing');
    $carolPage->assertSeeIn($current, 'Writing')
        ->assertCount('[data-slot="retro-column-add"]', 3);

    $alicePage->click($openComposer)
        ->fill($composer, $aliceCard)
        ->click($add)
        ->assertSee($aliceCard);
    $carolPage->assertSee('Hidden until the reveal')
        ->click($openComposer)
        ->fill($composer, $carolCard)
        ->click($add)
        ->assertSee($carolCard)
        ->assertDontSee($aliceCard);
    $alicePage->assertCount('article[id^="card-"]', 2)
        ->assertSee('Hidden until the reveal')
        ->assertDontSee($carolCard);

    $alicePage->click($next)
        ->assertSeeIn($current, 'Grouping')
        ->assertSee($carolCard);
    $carolPage->assertSeeIn($current, 'Grouping')
        ->assertSee($aliceCard)
        ->assertDontSee('Hidden until the reveal');

    $alicePage->click($previous)
        ->assertSeeIn($current, 'Writing')
        ->assertSee('Hidden until the reveal')
        ->assertSee($aliceCard)
        ->assertDontSee($carolCard)
        ->assertScript($inDocument($carolCard), false);
    $carolPage->assertSeeIn($current, 'Writing')
        ->assertSee('Hidden until the reveal')
        ->assertSee($carolCard)
        ->assertDontSee($aliceCard)
        ->assertScript($inDocument($aliceCard), false);

    $alicePage->click($previous)
        ->assertSeeIn($current, 'Icebreaker')
        ->assertPresent($stage)
        ->assertNotPresent('[data-test^="retro-column-"]');
    $carolPage->assertSeeIn($current, 'Icebreaker')
        ->assertPresent($stage)
        ->assertNotPresent('[data-test^="retro-column-"]');

    $aliceSnapshot = $this->snapshotOf($alicePage, "/retros/{$retro->id}/snapshot");
    $carolSnapshot = $this->snapshotOf($carolPage, "/retros/{$retro->id}/snapshot");
    $hiddenCard = ['hidden' => true, 'content' => null, 'author' => null];

    expect($aliceSnapshot['retro']['phase'])->toBe('icebreaker')
        ->and(p08aCardsSent($aliceSnapshot))->toBe([
            'mine' => ['hidden' => false, 'content' => $aliceCard, 'author' => 'Alice Martin'],
            'other' => $hiddenCard,
        ])
        ->and(json_encode($aliceSnapshot, JSON_THROW_ON_ERROR))->not->toContain($carolCard)
        ->and($carolSnapshot['retro']['phase'])->toBe('icebreaker')
        ->and(p08aCardsSent($carolSnapshot))->toBe([
            'mine' => ['hidden' => false, 'content' => $carolCard, 'author' => 'Carol Guest'],
            'other' => $hiddenCard,
        ])
        ->and(json_encode($carolSnapshot, JSON_THROW_ON_ERROR))->not->toContain($aliceCard);

    $alicePage->click($next)
        ->assertSeeIn($current, 'Writing')
        ->assertSee($aliceCard)
        ->assertSee('Hidden until the reveal')
        ->assertDontSee($carolCard);
    $carolPage->assertSeeIn($current, 'Writing')
        ->assertSee($carolCard)
        ->assertSee('Hidden until the reveal')
        ->assertDontSee($aliceCard);

    expect($retro->cards()->count())->toBe(2)
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Writing);
});

it('[P08a-04a] does not let the facilitator turn the Icebreaker off while the retro is in it', function () {
    [$retro, , $alice] = p08aBoard(RetroPhase::Icebreaker);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    p08aOpenSettings($page)
        ->assertAttribute('#retro-icebreaker', 'aria-checked', 'true')
        ->assertDisabled('#retro-icebreaker');

    expect($retro->fresh()->icebreaker_enabled)->toBeTrue();
});

it('[P08a-04b] shows the refusal of the server when the Icebreaker is turned off in its own phase', function () {
    [$retro, , $alice] = p08aBoard();

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    p08aOpenSettings($page)
        ->assertEnabled('#retro-icebreaker')
        ->click('#retro-icebreaker')
        ->assertAttribute('#retro-icebreaker', 'aria-checked', 'false');

    $retro->update(['phase' => RetroPhase::Icebreaker]);

    $page->click('[role="dialog"] button:has-text("Apply")')
        ->assertSeeIn('[role="dialog"]', 'Move to another phase before turning this phase off.');

    expect($retro->fresh()->icebreaker_enabled)->toBeTrue();
});

it('[P08a-04c] drops the Icebreaker step for everyone when it is turned off during Writing', function () {
    [$retro, , $alice, $bob] = p08aBoard();
    $stepper = 'header ol[aria-label="Phases"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertScript(p08aPhaseOrder(), 'Icebreaker > Writing > Grouping > Voting > Discussing > Actions > ROTI');
    $alicePage->assertPresent('header button:not([aria-disabled]):has-text("Previous")');

    p08aOpenSettings($alicePage)
        ->click('#retro-icebreaker')
        ->assertAttribute('#retro-icebreaker', 'aria-checked', 'false')
        ->click('[role="dialog"] button:has-text("Apply")')
        ->assertSeeIn('[role="dialog"]', 'No changes')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->assertScript(p08aPhaseOrder(), 'Writing > Grouping > Voting > Discussing > Actions > ROTI')
        ->assertPresent('header button[aria-disabled="true"]:has-text("Previous")');

    $bobPage->assertScript(p08aPhaseOrder(), 'Writing > Grouping > Voting > Discussing > Actions > ROTI')
        ->assertDontSeeIn($stepper, 'Icebreaker')
        ->assertSeeIn('[aria-current="step"]', 'Writing');

    expect($retro->fresh()->icebreaker_enabled)->toBeFalse()
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Writing);
});

it('[P08a-05] sets the automatic vote limit to the number of top-level cards plus three, at most ten', function (int $topLevelCards, int $limit) {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = p08aBoard(RetroPhase::Grouping, [
        'votes_per_participant' => null,
    ]);
    $cards = [];

    foreach (range(1, $topLevelCards) as $position) {
        $cards[] = p08aCard($retro, $columns[0], $aliceParticipant, "Topic {$position}", $position);
    }

    Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $columns[0]->id,
        'participant_id' => $aliceParticipant->id,
        'parent_card_id' => $cards[0]->id,
        'content' => 'Grouped under the first topic',
    ]);
    $total = $limit * 2;

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    p08aOpenSettings($alicePage)
        ->assertAttribute('#retro-votes-auto', 'aria-checked', 'true')
        ->assertEnabled('#retro-votes-auto')
        ->assertSeeIn('[role="dialog"]', 'Automatic: number of cards plus 3, at most 10.')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]');

    $alicePage->click('header button:has-text("Next")')
        ->assertSeeIn('[aria-current="step"]', 'Voting')
        ->assertSee("Votes left: {$limit}")
        ->assertSee("0 of {$total} votes cast");
    $bobPage->assertSeeIn('[aria-current="step"]', 'Voting')
        ->assertSee("Votes left: {$limit}")
        ->assertSee("0 of {$total} votes cast");

    p08aOpenSettings($alicePage)
        ->assertAttribute('#retro-votes-auto', 'aria-checked', 'true')
        ->assertDisabled('#retro-votes-auto');

    expect($retro->fresh()->votes_per_participant)->toBeNull()
        ->and($retro->fresh()->voteLimit())->toBe($limit);
})->with([
    'two top-level cards' => [2, 5],
    'nine top-level cards' => [9, 10],
]);

it('[P08a-06] edits the description of a column that has cards and keeps Rename disabled', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = p08aBoard();
    p08aCard($retro, $columns[0], $bobParticipant, 'Pair on reviews');
    $start = p08aColumn($columns[0]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->click("{$start} [aria-label=\"Column menu\"]")
        ->assertPresent('[role="menu"]')
        ->assertAttribute('[role="menuitem"]:has-text("Rename")', 'aria-disabled', 'true')
        ->assertAttribute('[role="menuitem"]:has-text("Delete column")', 'aria-disabled', 'true')
        ->assertSeeIn('[role="menu"]', 'Only empty columns can be renamed, recoloured or deleted.')
        ->click('[role="menuitem"]:has-text("Edit description")')
        ->assertSeeIn('[role="dialog"]', 'Column description')
        ->fill('[role="dialog"] textarea', 'What we should begin doing next sprint')
        ->click('[role="dialog"] button:has-text("Save")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($start, 'What we should begin doing next sprint');

    $bobPage->assertSeeIn($start, 'What we should begin doing next sprint')
        ->assertSeeIn("{$start} h3", 'Start')
        ->assertNotPresent('[aria-label="Column menu"]');

    expect($columns[0]->fresh()->description)->toBe('What we should begin doing next sprint')
        ->and($columns[0]->fresh()->title)->toBe('Start');
});
