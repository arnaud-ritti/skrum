<?php

use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Enums\TemplateCategory;
use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardTemplate;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;

const P18eTemplates = '[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"]';

const P18eDecks = '[role="dialog"] [role="radiogroup"][aria-label="Deck"]';

const P18eWhiteboardType = '[role="dialog"] [role="radiogroup"][aria-label="Session type"] [role="radio"][data-type="whiteboard"]';

const P18eGallery = '[role="dialog"] [role="radiogroup"][aria-label="Template"]';

const P18ePokerType = '[role="dialog"] [role="radiogroup"][aria-label="Session type"] [role="radio"][data-type="poker"]';

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

it('[P18e-01-04] creates a game and a saved deck from a named deck, and a one-off deck without a name', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->assertDontSee('New game')
        ->click('New session')
        ->click(P18ePokerType)
        ->assertVisible('#new-poker-title')
        ->fill('#new-poker-title', 'Named deck game')
        ->click('[role="dialog"] button:has-text("Create a deck")')
        ->assertNotPresent(P18eDecks)
        ->fill('#deck-custom-name', 'Halves')
        ->fill('#deck-custom-cards', '1, 2, 3')
        ->click('Use this deck')
        ->assertAttribute(P18eDecks.' [role="radio"]:has-text("Halves")', 'aria-checked', 'true')
        ->click('Create & open')
        ->assertPathBeginsWith('/poker/')
        ->assertSee('Halves');

    $named = PokerGame::query()->where('title', 'Named deck game')->sole();
    $saved = SavedPokerDeck::query()->sole();

    expect($named->cards)->toBe(['1', '2', '3', '?', '☕'])
        ->and($named->deck_name)->toBe('Halves')
        ->and($saved->name)->toBe('Halves')
        ->and($saved->team_id)->toBe($team->id)
        ->and($saved->cards)->toBe(['1', '2', '3', '?', '☕']);

    $page->navigate(p18eTeamPath($team))
        ->click('New session')
        ->click(P18ePokerType)
        ->assertVisible('#new-poker-title')
        ->assertSeeIn(P18eDecks.' [role="radio"]:has-text("Halves")', 'Saved')
        ->fill('#new-poker-title', 'One-off deck game')
        ->click('[role="dialog"] button:has-text("Create a deck")')
        ->fill('#deck-custom-cards', '5, 10')
        ->click('#deck-custom-coffee')
        ->click('Use this deck')
        ->assertAttribute(P18eDecks.' [role="radio"]:has-text("Custom deck")', 'aria-checked', 'true')
        ->assertSeeIn(P18eDecks.' [role="radio"]:has-text("Custom deck")', 'This game only')
        ->click('Create & open')
        ->assertPathBeginsWith('/poker/');

    $oneOff = PokerGame::query()->where('title', 'One-off deck game')->sole();

    expect($oneOff->cards)->toBe(['5', '10', '?'])
        ->and($oneOff->deck_name)->toBeNull()
        ->and(SavedPokerDeck::query()->count())->toBe(1);
});

it('[P18e-01-13] starts the game with the three typed tasks as its queue, in order', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);
    $queue = "[...document.querySelectorAll('[data-test=\"poker-task-row\"]')].map((row) => row.querySelector('span span').textContent).join(' / ')";

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->click('New session')
        ->click(P18ePokerType)
        ->assertVisible('#new-poker-title')
        ->assertAttribute('[role="dialog"] [role="tab"]:has-text("Later")', 'aria-selected', 'true')
        ->assertNotPresent('#new-poker-tasks')
        ->fill('#new-poker-title', 'Typed tasks')
        ->click('[role="dialog"] [role="tab"]:has-text("Type them")')
        ->fill('#new-poker-tasks', "Checkout flow\n\nSearch filters\nExport to CSV")
        ->assertSeeIn('[role="dialog"]', '3 / 50 tasks')
        ->click('Create & open')
        ->assertPathBeginsWith('/poker/')
        ->assertCount('[data-test="poker-task-row"]', 3)
        ->assertScript($queue, 'Checkout flow / Search filters / Export to CSV');

    $game = PokerGame::query()->where('title', 'Typed tasks')->sole();

    expect($game->tasks()->orderBy('position')->pluck('title')->all())
        ->toBe(['Checkout flow', 'Search filters', 'Export to CSV']);
});

it('[P18e-01-14] lets the creator arrive watching with "Watch only"', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->click('New session')
        ->click(P18ePokerType)
        ->assertVisible('#new-poker-title')
        ->fill('#new-poker-title', 'Facilitator watches')
        ->assertAttribute('#new-poker-spectator', 'aria-checked', 'false')
        ->click('#new-poker-spectator')
        ->assertAttribute('#new-poker-spectator', 'aria-checked', 'true')
        ->click('[role="dialog"] [role="tab"]:has-text("Type them")')
        ->fill('#new-poker-tasks', 'Checkout flow')
        ->click('Create & open')
        ->assertPathBeginsWith('/poker/')
        ->assertSee("You're watching — switch to Play to vote")
        ->assertNotPresent('[aria-label="Your cards"]');

    $game = PokerGame::query()->where('title', 'Facilitator watches')->sole();

    expect($game->players()->sole()->is_spectator)->toBeTrue()
        ->and($game->guest_access_enabled)->toBeFalse();
});

it('[P18e-01-15] preselects the default deck of the team', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);
    $deck = SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'name' => 'Team scale',
        'cards' => ['1', '2', '3', '5', '8', '?'],
        'created_by_user_id' => $alice->id,
    ]);
    $team->update(['default_saved_poker_deck_id' => $deck->id]);

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->click('New session')
        ->click(P18ePokerType)
        ->assertVisible('#new-poker-title')
        ->assertCount(P18eDecks.' [role="radio"]', 5)
        ->assertCount(P18eDecks.' [role="radio"][aria-checked="true"]', 1)
        ->assertSeeIn(P18eDecks.' [role="radio"][aria-checked="true"]', 'Team scale')
        ->fill('#new-poker-title', 'Default deck game')
        ->click('Create & open')
        ->assertPathBeginsWith('/poker/')
        ->assertSee('Team scale');

    $game = PokerGame::query()->where('title', 'Default deck game')->sole();

    expect($game->cards)->toBe(['1', '2', '3', '5', '8', '?'])
        ->and($game->deck_name)->toBe('Team scale');
});

it('[P18e-01-05] picks a whiteboard template with the arrows, and creates a board from a workspace template', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);
    $template = WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Kick-off map',
        'scene' => ['elements' => [sceneElement(['id' => 'p18eOnly', 'x' => 300, 'y' => 200])], 'files' => []],
        'created_by_user_id' => $alice->id,
    ]);
    $checked = P18eGallery.' [role="radio"][aria-checked="true"]';
    $workspaceTile = P18eGallery.' [role="radio"]:has(span:text-is("Kick-off map"))';
    $keepKeyDownForAMoment = fn (mixed $page, string $key): mixed => $page->script("() => { const radio = document.querySelector('".addslashes($checked)."'); radio.focus(); radio.dispatchEvent(new KeyboardEvent('keydown', { key: '{$key}', bubbles: true, cancelable: true })); return new Promise((resolve) => setTimeout(() => { document.dispatchEvent(new KeyboardEvent('keyup', { key: '{$key}', bubbles: true })); resolve(true); }, 100)); }");
    $storeBody = "(() => { const send = XMLHttpRequest.prototype.send; window.p18eBodies = []; XMLHttpRequest.prototype.send = function (body) { window.p18eBodies.push(typeof body === 'string' ? body : ''); return send.call(this, body); }; return true; })()";

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->click('New session')
        ->click(P18eWhiteboardType)
        ->assertVisible('#whiteboard-title')
        ->assertCount(P18eGallery, 2)
        ->assertCount($checked, 1)
        ->assertSeeIn($checked, 'Blank');

    $keepKeyDownForAMoment($page, 'ArrowRight');

    $page->assertCount($checked, 1)
        ->assertSeeIn($checked, 'Brainstorm');

    $keepKeyDownForAMoment($page, 'ArrowLeft');

    $page->assertSeeIn($checked, 'Blank')
        ->click($workspaceTile)
        ->assertCount($checked, 1)
        ->assertSeeIn($checked, 'Kick-off map')
        ->fill('#whiteboard-title', 'From the workspace')
        ->assertScript($storeBody, true)
        ->click('Create & open')
        ->assertPathBeginsWith('/whiteboards/');

    $board = Whiteboard::query()->where('title', 'From the workspace')->sole();

    expect($board->elements()->count())->toBe(1)
        ->and($board->guest_access_enabled)->toBeFalse();

    $body = json_decode((string) $page->script("window.p18eBodies.find((body) => body.includes('From the workspace'))"), true);

    expect($body)->toHaveKey('workspace_template_id', $template->id)
        ->and($body)->not->toHaveKey('template');
});

it('[P18e-01-16] keeps a whiteboard template when its deletion is cancelled in the confirmation dialog', function () {
    $team = Team::factory()->create();
    $alice = p18eMember($team);
    $template = WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Kick-off map',
        'created_by_user_id' => $alice->id,
    ]);
    $row = '[role="dialog"] li:has(p:text-is("Kick-off map"))';

    $page = $this->signIn($alice, p18eTeamPath($team));

    $page->click('button:text-is("Whiteboard templates")')
        ->assertPresent($row)
        ->click("{$row} button[aria-label=\"Delete Kick-off map\"]")
        ->assertSeeIn('[role="alertdialog"]', 'Delete this template?')
        ->assertSeeIn('[role="alertdialog"]', 'Boards already created from it are not changed.')
        ->click('[role="alertdialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertPresent($row);

    expect(WhiteboardTemplate::query()->whereKey($template->id)->exists())->toBeTrue();

    $page->click("{$row} button[aria-label=\"Delete Kick-off map\"]")
        ->click('[role="alertdialog"] button:has-text("Delete")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertNotPresent($row)
        ->assertSeeIn('[role="dialog"]', 'No whiteboard templates yet.');

    expect(WhiteboardTemplate::query()->count())->toBe(0);
});
