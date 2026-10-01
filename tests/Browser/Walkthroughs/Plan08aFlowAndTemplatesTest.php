<?php

use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Enums\TemplateCategory;
use App\Enums\WorkspaceRole;
use App\Models\Column;
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
        ['Energy', 'How much energy the sprint left us', ColumnColor::Green],
        ['Blockers', 'What kept slowing us down', ColumnColor::Red],
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
    return "[...document.querySelectorAll('header ol[aria-label=\"Phases\"] li')].map((step) => step.textContent).join(' > ')";
}

function p08aColumnTitles(): string
{
    return "[...document.querySelectorAll('[data-test^=\"retro-column-\"] h2')].map((title) => title.textContent).join(' | ')";
}

it('[P08a-01a] prefills the title and filters the template catalogue by search and by category', function () {
    $team = Team::factory()->create();
    $alice = p08aMember($team);
    $templates = '[role="dialog"] li button';
    $all = '[role="dialog"] [aria-label="Category"] button:first-child';
    $themed = '[role="dialog"] [aria-label="Category"] button:has-text("Themed & fun")';
    $search = '[aria-label="Search templates"]';
    $preview = '[role="dialog"] div:has(> h3:has-text("Preview"))';
    $prefilledTitle = "document.querySelector('#new-retro-title').value === 'Retro ' + new Date().toLocaleDateString('en', { dateStyle: 'medium' })";
    $swatches = "[...[...document.querySelectorAll('[role=\"dialog\"] h3')].find((heading) => heading.textContent === 'Preview').parentElement.querySelectorAll('li > span')].map((swatch) => [...swatch.classList].find((name) => name.startsWith('bg-'))).join(',')";

    $page = $this->signIn($alice, p08aTeamPath($team));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->assertScript($prefilledTitle, true)
        ->assertSeeIn('[role="dialog"]', 'Common templates')
        ->assertSeeIn('[role="dialog"]', 'More templates')
        ->assertCount($templates, 53)
        ->assertCount("{$templates}:has-text(\"Empty board\")", 1)
        ->assertAttribute($all, 'aria-pressed', 'true');

    $page->fill($search, 'sail')
        ->assertCount($templates, 1)
        ->assertSeeIn($templates, 'Sailboat')
        ->assertSeeIn($templates, 'Themed & fun')
        ->assertSeeIn($templates, 'What anchors are holding us back?')
        ->assertSeeIn($preview, 'Sailboat')
        ->assertCount("{$preview} li", 4)
        ->assertSeeIn($preview, 'What anchors are holding us back?')
        ->assertSeeIn($preview, 'What slows us down and adds drag every sprint')
        ->assertSeeIn($preview, 'What is our ideal island destination?')
        ->assertScript($swatches, 'bg-emerald-500,bg-rose-500,bg-amber-500,bg-sky-500');

    $page->fill($search, 'no such template')
        ->assertSeeIn('[role="dialog"]', 'No templates match your search.')
        ->assertNotPresent($templates)
        ->fill($search, '')
        ->assertCount($templates, 53);

    $page->click($themed)
        ->assertAttribute($themed, 'aria-pressed', 'true')
        ->assertAttribute($all, 'aria-pressed', 'false')
        ->assertCount($templates, 9)
        ->assertCount("{$templates}:has-text(\"Sailboat\")", 1)
        ->assertNotPresent("{$templates}:has-text(\"Empty board\")")
        ->assertNotPresent("{$templates}:has-text(\"Start, Stop, Continue\")")
        ->click($all)
        ->assertCount($templates, 53)
        ->click("{$templates}:has-text(\"Empty board\")")
        ->assertSeeIn($preview, 'Custom')
        ->assertSeeIn($preview, 'Start with an empty board and add your own columns.');

    expect(Retro::query()->count())->toBe(0);
});

it('[P08a-01b] starts a retro in the Icebreaker phase with the automatic vote limit from the creation dialog', function () {
    $team = Team::factory()->create();
    $alice = p08aMember($team);
    $templates = '[role="dialog"] li button';

    $page = $this->signIn($alice, p08aTeamPath($team));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 14 retro')
        ->fill('[aria-label="Search templates"]', 'sail')
        ->assertCount($templates, 1)
        ->click($templates)
        ->assertAttribute($templates, 'aria-pressed', 'true')
        ->click('[role="dialog"] button:has-text("Settings")')
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
        ->assertSeeIn('header > h1', 'Sprint 14 retro')
        ->assertSeeIn('[aria-current="step"]', 'Icebreaker')
        ->assertScript(p08aPhaseOrder(), 'Icebreaker > Writing > Grouping > Voting > Discussing > Completed')
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

it('[P08a-07a] shows the workspace templates to a member as a read-only list', function () {
    $team = Team::factory()->create();
    $alice = p08aMember($team);
    p08aTemplate($team->workspace);
    $row = 'li:has-text("Team pulse")';

    $page = $this->signIn($alice, p08aTeamPath($team));

    $page->assertPresent('a[href$="/templates"]')
        ->click('a[href$="/templates"]')
        ->assertPathIs("/w/{$team->workspace->slug}/templates")
        ->assertSee('Templates shared by every team of this workspace')
        ->assertSeeIn($row, 'Team pulse')
        ->assertSeeIn($row, 'Team & mood')
        ->assertSeeIn($row, 'Energy')
        ->assertSeeIn($row, 'Blockers')
        ->assertNotPresent("{$row} button")
        ->assertNotPresent('button:has-text("New template")');

    expect(WorkspaceTemplate::query()->count())->toBe(1);
});

it('[P08a-07b] lets an Owner create a workspace template from a built-in one', function () {
    $team = Team::factory()->create();
    $olivia = p08aOwner($team);
    $row = 'li:has-text("Team pulse")';
    $titles = "[...document.querySelectorAll('[role=\"dialog\"] [aria-label=\"Column title\"]')].map((input) => input.value).join(' | ')";
    $moveFirstDown = '[role="dialog"] fieldset > div:nth-of-type(1) [aria-label="Move down"]';
    $removeThird = '[role="dialog"] fieldset > div:nth-of-type(3) [aria-label="Remove column"]';

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
        ->assertScript($titles, 'Start | Stop | Continue');

    $page->fill('#template-name', 'Team pulse')
        ->click('#template-category')
        ->assertPresent('[role="listbox"]')
        ->click('[role="option"]:has-text("Team & mood")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('#template-category', 'Team & mood')
        ->click($moveFirstDown)
        ->assertScript($titles, 'Stop | Start | Continue')
        ->click($removeThird)
        ->assertScript($titles, 'Stop | Start')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertSee('Template saved.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($row, 'Team & mood')
        ->assertSeeIn($row, 'Stop')
        ->assertSeeIn($row, 'Start')
        ->assertDontSeeIn($row, 'Continue')
        ->assertPresent("{$row} button:has-text(\"Edit\")")
        ->assertPresent("{$row} button:has-text(\"Delete\")");

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
    $templates = '[role="dialog"] li button';
    $preview = '[role="dialog"] div:has(> h3:has-text("Preview"))';
    $firstTemplate = "document.querySelector('[role=\"dialog\"] li button').innerText.includes('Team pulse')";

    $page = $this->signIn($alice, p08aTeamPath($team));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Pulse check')
        ->assertSeeIn('[role="dialog"]', 'Workspace templates')
        ->assertCount($templates, 54)
        ->click('[role="dialog"] [aria-label="Category"] button:has-text("Team & mood")')
        ->assertCount($templates, 9)
        ->assertScript($firstTemplate, true)
        ->click("{$templates}:has-text(\"Team pulse\")")
        ->assertAttribute("{$templates}:has-text(\"Team pulse\")", 'aria-pressed', 'true')
        ->assertSeeIn($preview, 'Team pulse')
        ->assertSeeIn($preview, 'How much energy the sprint left us')
        ->assertSeeIn($preview, 'What kept slowing us down')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Pulse check')
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
    $row = 'li:has-text("Team pulse")';

    $page = $this->signIn($olivia, "/w/{$team->workspace->slug}/templates");

    $page->assertSeeIn($row, 'Energy')
        ->click("{$row} button:has-text(\"Delete\")")
        ->assertSeeIn('[role="dialog"]', 'Delete this template?')
        ->assertSeeIn('[role="dialog"]', 'Retrospectives created from it keep their columns.')
        ->click('[role="dialog"] button:has-text("Delete")')
        ->assertSee('Template deleted.')
        ->assertSee('No workspace templates yet.')
        ->navigate("/retros/{$retro->id}")
        ->assertSeeIn('header > h1', 'Pulse check')
        ->assertCount('[data-test^="retro-column-"]', 2)
        ->assertScript(p08aColumnTitles(), 'Energy | Blockers');

    expect(WorkspaceTemplate::query()->whereKey($template->id)->exists())->toBeFalse()
        ->and($retro->fresh()->workspace_template_id)->toBeNull()
        ->and($retro->fresh()->template)->toBe('workspace')
        ->and($retro->columns()->count())->toBe(2);
});
