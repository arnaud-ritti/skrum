<?php

use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Enums\TemplateCategory;
use App\Enums\WorkspaceRole;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;

const P18eTemplates = '[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"]';

function p18eMember(Team $team, string $name = 'Alice Martin'): User
{
    $user = teamMember($team);

    $user->update(['name' => $name, 'locale' => 'en']);

    return $user;
}

function p18eTeamPath(Team $team, string $query = ''): string
{
    return route('teams.show', [$team->workspace, $team], false).$query;
}

it('[P18e-01-01] opens one "New session" dialog on the Retrospective type, with the form of that type', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $alice = p18eMember($team);
    $types = '[role="dialog"] [role="radiogroup"][aria-label="Session type"]';

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->assertDontSee('New retrospective')
        ->click('New session')
        ->assertSeeIn('[role="dialog"]', 'New session')
        ->assertSeeIn('[role="dialog"]', 'Team Atlas')
        ->assertAttribute("{$types} [role=\"radio\"][data-type=\"retro\"]", 'aria-checked', 'true')
        ->assertNotPresent("{$types} [role=\"radio\"][data-type=\"survey\"]")
        ->assertVisible('#new-retro-title')
        ->assertCount('[role="dialog"] button[type="submit"]', 1)
        ->assertSeeIn('[role="dialog"] button[type="submit"]', 'Create & open')
        ->fill('#new-retro-title', 'Kept while the dialog is open')
        ->click('#new-retro-anonymous')
        ->click("{$types} [role=\"radio\"][data-type=\"retro\"]")
        ->assertValue('#new-retro-title', 'Kept while the dialog is open')
        ->assertAttribute('#new-retro-anonymous', 'aria-checked', 'true')
        ->click('Cancel')
        ->assertNotPresent('[role="dialog"]');

    expect(Retro::query()->count())->toBe(0);
});

it('[P18e-01-02] creates a retro from a workspace template found under "Browse", tab "My workspace"', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);
    $template = WorkspaceTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Team pulse',
        'category' => TemplateCategory::TeamMood,
    ]);

    foreach ([['Energy', ColumnColor::Green], ['Blockers', ColumnColor::Red]] as $position => [$title, $color]) {
        WorkspaceTemplateColumn::factory()->create([
            'workspace_template_id' => $template->id,
            'title' => $title,
            'description' => null,
            'color' => $color,
            'position' => $position,
        ]);
    }

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Pulse check')
        ->assertCount(P18eTemplates.' [role="radio"]', 5)
        ->assertNotPresent(P18eTemplates.' [role="radio"]:has-text("Team pulse")')
        ->click('Browse')
        ->assertVisible('[aria-label="Search templates"]')
        ->click('[role="dialog"] [role="tab"]:has-text("My workspace")')
        ->click(P18eTemplates.' [role="radio"]:has-text("Team pulse")')
        ->assertAttribute(P18eTemplates.' [role="radio"]:has-text("Team pulse")', 'aria-checked', 'true')
        ->click('[role="dialog"] button:has-text("Back")')
        ->assertNotPresent('[aria-label="Search templates"]')
        ->assertSeeIn(P18eTemplates.' [role="radio"][aria-checked="true"]', 'Team pulse')
        ->assertSeeIn('[role="dialog"]', 'Columns · 2')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Pulse check')
        ->assertCount('[data-test^="retro-column-"]', 2);

    $retro = Retro::query()->where('title', 'Pulse check')->sole();

    expect($retro->template)->toBe('workspace')
        ->and($retro->workspace_template_id)->toBe($template->id)
        ->and($retro->columns->pluck('title')->all())->toBe(['Energy', 'Blockers']);
});

it('[P18e-01-03] submits the dialog with Enter in the name', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->click('New session')
        ->assertVisible('#new-retro-title')
        ->assertCount(P18eTemplates.' [role="radio"]', 5)
        ->fill('#new-retro-title', 'Enter retro')
        ->keys('#new-retro-title', 'Enter')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Enter retro');

    $retro = Retro::query()->where('title', 'Enter retro')->sole();

    expect($retro->template)->toBe('went_well_to_improve_actions')
        ->and($retro->guest_access_enabled)->toBeFalse()
        ->and($retro->phase)->toBe(RetroPhase::Writing);
});

it('[P18e-01-06] shows the dialog as a full-height drawer with a reachable footer at 375 px', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);
    $drawer = '[data-dialog="new-session"][data-slot="drawer-content"]';
    $fullHeight = "Math.abs(document.querySelector('{$drawer}').getBoundingClientRect().height - window.innerHeight) <= 1";
    $noOverflow = 'document.documentElement.scrollWidth <= window.innerWidth';
    $footerReachable = "(() => { const box = document.querySelector('[role=\"dialog\"] button[type=\"submit\"]').getBoundingClientRect(); return box.top >= 0 && box.bottom <= window.innerHeight && box.right <= window.innerWidth; })()";

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->resize(375, 812)
        ->click('New session')
        ->assertVisible('#new-retro-title')
        ->assertPresent($drawer)
        ->assertCount(P18eTemplates.' [role="radio"]', 5)
        ->assertScript($fullHeight, true)
        ->assertScript($noOverflow, true)
        ->assertScript($footerReachable, true)
        ->fill('#new-retro-title', 'Phone retro')
        ->assertScript($footerReachable, true)
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/');

    expect(Retro::query()->where('title', 'Phone retro')->exists())->toBeTrue();
});

it('[P18e-01-09] starts the five shortcuts with the template the team used most', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);
    $order = "[...document.querySelectorAll('".P18eTemplates." [role=\"radio\"]')].map((radio) => radio.dataset.templateId).join(',')";

    Retro::factory()->count(3)->create(['team_id' => $team->id, 'template' => 'sailboat']);

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->click('New session')
        ->assertVisible('#new-retro-title')
        ->assertCount(P18eTemplates.' [role="radio"]', 5)
        ->assertScript($order, 'sailboat,went_well_to_improve_actions,start_stop_continue,four_ls,mad_sad_glad')
        ->assertSeeIn(P18eTemplates.' [role="radio"][aria-checked="true"]', 'Sailboat')
        ->assertSeeIn('[role="dialog"]', 'Columns · 4');
});

it('[P18e-01-10] creates the board with the columns renamed, added and reordered in the dialog', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);
    $handle = '[role="dialog"] button[aria-label^="Reorder “Start”"]';
    $titles = "[...document.querySelectorAll('[role=\"dialog\"] [data-slot=\"retro-column-draft\"] input')].map((input) => input.value).join(' | ')";

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Edited columns')
        ->click(P18eTemplates.' [role="radio"]:has-text("Start, Stop, Continue")')
        ->assertSeeIn('[role="dialog"]', 'Columns · 3')
        ->assertScript($titles, 'Start | Stop | Continue')
        ->fill('[role="dialog"] [aria-label="Column 2 title"]', 'Pause')
        ->click('Add a column')
        ->assertSeeIn('[role="dialog"]', 'Columns · 4')
        ->fill('[role="dialog"] [aria-label="Column 4 title"]', 'Ideas')
        ->click('[role="dialog"] [role="radiogroup"][aria-label="Color of “Ideas”"] [role="radio"][data-color="purple"]');

    $this->dragWithKeyboard($page, $handle, ['Space', 'ArrowRight', 'Space']);

    $page->assertScript($titles, 'Pause | Start | Continue | Ideas')
        ->assertVisible('[role="dialog"]')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Edited columns')
        ->assertCount('[data-test^="retro-column-"]', 4);

    $retro = Retro::query()->where('title', 'Edited columns')->sole();

    expect($retro->template)->toBe('start_stop_continue')
        ->and($retro->columns->pluck('title')->all())->toBe(['Pause', 'Start', 'Continue', 'Ideas'])
        ->and($retro->columns->pluck('color')->map(fn (ColumnColor $color): string => $color->value)->all())
        ->toBe(['red', 'green', 'blue', 'purple']);
});

it('[P18e-01-11] opens the guest link of the new retro with "Anonymous guests allowed"', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->click('New session')
        ->assertVisible('#new-retro-title')
        ->assertCount(P18eTemplates.' [role="radio"]', 5)
        ->fill('#new-retro-title', 'Open to guests')
        ->assertAttribute('#new-retro-guests', 'aria-checked', 'false')
        ->click('#new-retro-guests')
        ->assertAttribute('#new-retro-guests', 'aria-checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Open to guests');

    $retro = Retro::query()->where('title', 'Open to guests')->sole();

    expect($retro->guest_access_enabled)->toBeTrue();

    $guestPage = $this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest');

    $guestPage->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Open to guests');
});

it('[P18e-01-12] opens the dialog on the template named by the URL and leaves a clean URL', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);

    $page = $this->signIn($alice, p18eTeamPath($team, '?new=retro&template=four_ls'));

    $page->assertVisible('#new-retro-title')
        ->assertSeeIn(P18eTemplates.' [role="radio"][aria-checked="true"]', 'Liked, Learned, Lacked, Longed for')
        ->assertSeeIn('[role="dialog"]', 'Columns · 4')
        ->assertScript('window.location.search', '')
        ->assertPathIs(p18eTeamPath($team))
        ->fill('#new-retro-title', 'From a link')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/');

    expect(Retro::query()->where('title', 'From a link')->sole()->template)->toBe('four_ls');
});

it('[P18e-01-17] saves the edited columns as a team template and creates the retro from it', function () {
    $team = Team::factory()->create();
    $olivia = workspaceManager($team->workspace, WorkspaceRole::Admin);
    $team->members()->attach($olivia);
    $olivia->update(['name' => 'Olivia Owner', 'locale' => 'en']);
    $bob = p18eMember($team, 'Bob Member');

    $memberPage = $this->signIn($bob, p18eTeamPath($team));

    $memberPage->click('New session')
        ->assertVisible('#new-retro-title')
        ->assertNotPresent('#new-retro-save-template');

    $page = $this->signIn($olivia, p18eTeamPath($team));

    $page->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Harbour retro')
        ->click(P18eTemplates.' [role="radio"]:has-text("Start, Stop, Continue")')
        ->fill('[role="dialog"] [aria-label="Column 3 title"]', 'Keep going')
        ->click('#new-retro-save-template')
        ->assertAttribute('#new-retro-save-template', 'aria-checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Harbour retro');

    $template = WorkspaceTemplate::query()->where('name', 'Harbour retro')->sole();
    $retro = Retro::query()->where('title', 'Harbour retro')->sole();

    expect($template->workspace_id)->toBe($team->workspace_id)
        ->and($template->columns->pluck('title')->all())->toBe(['Start', 'Stop', 'Keep going'])
        ->and($retro->workspace_template_id)->toBe($template->id)
        ->and($retro->columns->pluck('title')->all())->toBe(['Start', 'Stop', 'Keep going']);
});
