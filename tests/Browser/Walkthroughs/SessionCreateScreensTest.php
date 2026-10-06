<?php

use App\Enums\ColumnColor;
use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\RetroPhase;
use App\Enums\TemplateCategory;
use App\Enums\WorkspaceRole;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardTemplate;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;

const SessionCreateScreensTemplates = '[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"]';

const SessionCreateScreensDecks = '[role="dialog"] [role="radiogroup"][aria-label="Deck"]';

const SessionCreateScreensWhiteboardType = '[role="dialog"] [role="radiogroup"][aria-label="Session type"] [role="radio"][data-type="whiteboard"]';

const SessionCreateScreensGallery = '[role="dialog"] [data-slot="whiteboard-template-gallery"] [role="radiogroup"]';

const SessionCreateScreensTypes = '[role="dialog"] [role="radiogroup"][aria-label="Session type"]';

const SessionCreateScreensGames = '[role="dialog"] [role="radiogroup"][aria-label="Choose an icebreaker"]';

const SessionCreateScreensPokerType = '[role="dialog"] [role="radiogroup"][aria-label="Session type"] [role="radio"][data-type="poker"]';

function sessionCreateScreensTeamPath(Team $team, string $query = ''): string
{
    return route('teams.show', [$team->workspace, $team], false).$query;
}

it('opens one "New session" dialog on the Retrospective type and keeps the fields of each type when switching', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $retroType = SessionCreateScreensTypes.' [role="radio"][data-type="retro"]';
    $submitOf = fn (string $slot): string => "(() => { const buttons = document.querySelectorAll('[role=\"dialog\"] button[type=\"submit\"]'); const form = buttons[0]?.form; return buttons.length === 1 && form?.dataset.slot === '{$slot}' && form.offsetParent !== null && document.querySelectorAll('[role=\"dialog\"] [data-session-form]:not([hidden])').length === 1; })()";

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->assertNotPresent('button:has-text("New retrospective")')
        ->click('button:has-text("New session")')
        ->assertSeeIn('[role="dialog"]', 'New session')
        ->assertSeeIn('[role="dialog"]', 'Team Atlas')
        ->assertAttribute($retroType, 'aria-checked', 'true')
        ->assertSeeIn(SessionCreateScreensTypes.' [role="radio"][data-type="survey"]', 'Poll')
        ->assertVisible('#new-retro-title')
        ->assertSeeIn('[role="dialog"] button[type="submit"]', 'Create & open')
        ->assertScript($submitOf('retro-session-fields'), true)
        ->fill('#new-retro-title', 'Kept retro')
        ->click('#new-retro-anonymous')
        ->click(SessionCreateScreensPokerType)
        ->assertVisible('#new-poker-title')
        ->assertScript('document.activeElement?.id', 'new-poker-title')
        ->assertScript($submitOf('poker-session-fields'), true)
        ->fill('#new-poker-title', 'Kept poker')
        ->click('#new-poker-auto-reveal')
        ->click(SessionCreateScreensWhiteboardType)
        ->assertVisible('#whiteboard-title')
        ->assertScript('document.activeElement?.id', 'whiteboard-title')
        ->assertScript($submitOf('whiteboard-session-fields'), true)
        ->fill('#whiteboard-title', 'Kept board')
        ->click('#new-whiteboard-guests')
        ->click($retroType)
        ->assertVisible('#new-retro-title')
        ->assertValue('#new-retro-title', 'Kept retro')
        ->assertAttribute('#new-retro-anonymous', 'aria-checked', 'true')
        ->assertScript($submitOf('retro-session-fields'), true)
        ->click(SessionCreateScreensPokerType)
        ->assertVisible('#new-poker-title')
        ->assertValue('#new-poker-title', 'Kept poker')
        ->assertAttribute('#new-poker-auto-reveal', 'aria-checked', 'true')
        ->assertScript($submitOf('poker-session-fields'), true)
        ->click(SessionCreateScreensWhiteboardType)
        ->assertVisible('#whiteboard-title')
        ->assertValue('#whiteboard-title', 'Kept board')
        ->assertAttribute('#new-whiteboard-guests', 'aria-checked', 'true')
        ->assertScript($submitOf('whiteboard-session-fields'), true)
        ->click('Cancel')
        ->assertNotPresent('[role="dialog"]');

    expect(Retro::query()->count())->toBe(0)
        ->and(PokerGame::query()->count())->toBe(0)
        ->and(Whiteboard::query()->count())->toBe(0);
});

it('creates a retro from a workspace template found under "Browse", tab "My workspace"', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $template = WorkspaceTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Team pulse',
        'category' => TemplateCategory::TeamMood,
    ]);

    foreach ([['Energy', ColumnColor::Moss], ['Blockers', ColumnColor::Coral]] as $position => [$title, $color]) {
        WorkspaceTemplateColumn::factory()->create([
            'workspace_template_id' => $template->id,
            'title' => $title,
            'description' => null,
            'color' => $color,
            'position' => $position,
        ]);
    }

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Pulse check')
        ->assertCount(SessionCreateScreensTemplates.' [role="radio"]', 5)
        ->assertNotPresent(SessionCreateScreensTemplates.' [role="radio"]:has-text("Team pulse")')
        ->click('Browse')
        ->assertVisible('[aria-label="Search templates"]')
        ->click('[role="dialog"] [role="tab"]:has-text("My workspace")')
        ->fill('[aria-label="Search templates"]', 'pulse')
        ->keys('[aria-label="Search templates"]', 'Enter')
        ->assertPathIs(sessionCreateScreensTeamPath($team))
        ->assertVisible('[aria-label="Search templates"]')
        ->click(SessionCreateScreensTemplates.' [role="radio"]:has-text("Team pulse")')
        ->assertAttribute(SessionCreateScreensTemplates.' [role="radio"]:has-text("Team pulse")', 'aria-checked', 'true')
        ->click('[role="dialog"] button:has-text("Back")')
        ->assertNotPresent('[aria-label="Search templates"]')
        ->assertSeeIn(SessionCreateScreensTemplates.' [role="radio"][aria-checked="true"]', 'Team pulse')
        ->assertSeeIn('[role="dialog"]', 'Columns · 2')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header:has(h1) h1', 'Pulse check')
        ->assertCount('[data-test^="retro-column-"]', 2);

    $retro = Retro::query()->where('title', 'Pulse check')->sole();

    expect(Retro::query()->count())->toBe(1)
        ->and($retro->template)->toBe('workspace')
        ->and($retro->workspace_template_id)->toBe($template->id)
        ->and($retro->columns->pluck('title')->all())->toBe(['Energy', 'Blockers']);
});

it('submits the dialog with Enter in the name', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->click('New session')
        ->assertVisible('#new-retro-title')
        ->assertCount(SessionCreateScreensTemplates.' [role="radio"]', 5)
        ->fill('#new-retro-title', 'Enter retro')
        ->keys('#new-retro-title', 'Enter')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header:has(h1) h1', 'Enter retro');

    $retro = Retro::query()->where('title', 'Enter retro')->sole();

    expect($retro->template)->toBe('went_well_to_improve_actions')
        ->and($retro->guest_access_enabled)->toBeFalse()
        ->and($retro->phase)->toBe(RetroPhase::Writing);
});

it('shows the dialog as a full-height drawer with a reachable footer at 375 px', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $drawer = '[data-dialog="new-session"][data-slot="drawer-content"]';
    $fullHeight = "Math.abs(document.querySelector('{$drawer}').getBoundingClientRect().height - window.innerHeight) <= 1";
    $noOverflow = 'document.documentElement.scrollWidth <= window.innerWidth';
    $footerReachable = "(() => { const box = document.querySelector('[role=\"dialog\"] button[type=\"submit\"]').getBoundingClientRect(); return box.top >= 0 && box.bottom <= window.innerHeight && box.right <= window.innerWidth; })()";

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->resize(375, 812)
        ->click('New session')
        ->assertVisible('#new-retro-title')
        ->assertPresent($drawer)
        ->assertCount(SessionCreateScreensTemplates.' [role="radio"]', 5)
        ->assertScript($fullHeight, true)
        ->assertScript($noOverflow, true)
        ->assertScript($footerReachable, true)
        ->fill('#new-retro-title', 'Phone retro')
        ->assertScript($footerReachable, true)
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/');

    expect(Retro::query()->where('title', 'Phone retro')->exists())->toBeTrue();
});

it('starts the five shortcuts with the template the team used most', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $order = "[...document.querySelectorAll('".SessionCreateScreensTemplates." [role=\"radio\"]')].map((radio) => radio.dataset.templateId).join(',')";

    Retro::factory()->count(3)->create(['team_id' => $team->id, 'template' => 'sailboat']);

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->click('New session')
        ->assertVisible('#new-retro-title')
        ->assertCount(SessionCreateScreensTemplates.' [role="radio"]', 5)
        ->assertScript($order, 'sailboat,went_well_to_improve_actions,start_stop_continue,four_ls,mad_sad_glad')
        ->assertSeeIn(SessionCreateScreensTemplates.' [role="radio"][aria-checked="true"]', 'Sailboat')
        ->assertSeeIn('[role="dialog"]', 'Columns · 4');
});

it('creates the board with the columns renamed, added and reordered in the dialog', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $handle = '[role="dialog"] button[aria-label^="Reorder “Start”"]';
    $titles = "[...document.querySelectorAll('[role=\"dialog\"] [data-slot=\"retro-column-draft\"] input')].map((input) => input.value).join(' | ')";

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Edited columns')
        ->click(SessionCreateScreensTemplates.' [role="radio"]:has-text("Start, Stop, Continue")')
        ->assertSeeIn('[role="dialog"]', 'Columns · 3')
        ->assertScript($titles, 'Start | Stop | Continue')
        ->fill('[role="dialog"] [aria-label="Column 2 title"]', 'Pause')
        ->click('Add a column')
        ->assertSeeIn('[role="dialog"]', 'Columns · 4')
        ->fill('[role="dialog"] [aria-label="Column 4 title"]', 'Ideas')
        ->click('[role="dialog"] [role="radiogroup"][aria-label="Colour of “Ideas”"] [role="radio"][data-color="plum"]');

    $this->dragWithKeyboard($page, $handle, ['Space', 'ArrowRight', 'Space']);

    $page->assertScript($titles, 'Pause | Start | Continue | Ideas')
        ->assertVisible('[role="dialog"]')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header:has(h1) h1', 'Edited columns')
        ->assertCount('[data-test^="retro-column-"]', 4);

    $retro = Retro::query()->where('title', 'Edited columns')->sole();

    expect($retro->template)->toBe('start_stop_continue')
        ->and($retro->columns->pluck('title')->all())->toBe(['Pause', 'Start', 'Continue', 'Ideas'])
        ->and($retro->columns->pluck('color')->map(fn (ColumnColor $color): string => $color->value)->all())
        ->toBe(['coral', 'moss', 'sky', 'plum']);
});

it('opens the guest link of the new retro with "Anonymous guests allowed"', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->click('New session')
        ->assertVisible('#new-retro-title')
        ->assertCount(SessionCreateScreensTemplates.' [role="radio"]', 5)
        ->fill('#new-retro-title', 'Open to guests')
        ->assertAttribute('#new-retro-guests', 'aria-checked', 'false')
        ->click('#new-retro-guests')
        ->assertAttribute('#new-retro-guests', 'aria-checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header:has(h1) h1', 'Open to guests');

    $retro = Retro::query()->where('title', 'Open to guests')->sole();

    expect($retro->guest_access_enabled)->toBeTrue();

    $guestPage = $this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest');

    $guestPage->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header:has(h1) h1', 'Open to guests');
});

it('opens the dialog on the template named by the URL and leaves a clean URL', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team, '?new=retro&template=four_ls'));

    $page->assertVisible('#new-retro-title')
        ->assertSeeIn(SessionCreateScreensTemplates.' [role="radio"][aria-checked="true"]', 'Liked, Learned, Lacked, Longed for')
        ->assertSeeIn('[role="dialog"]', 'Columns · 4')
        ->assertScript('window.location.search', '')
        ->assertPathIs(sessionCreateScreensTeamPath($team))
        ->fill('#new-retro-title', 'From a link')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/');

    expect(Retro::query()->where('title', 'From a link')->sole()->template)->toBe('four_ls');
});

it('saves the edited columns as a team template and creates the retro from it', function () {
    $team = Team::factory()->create();
    $olivia = workspaceManager($team->workspace, WorkspaceRole::Admin);
    $team->members()->attach($olivia);
    $olivia->update(['name' => 'Olivia Owner', 'locale' => 'en']);
    $bob = renamedUser(teamMember($team), 'Bob Member');

    $memberPage = $this->signIn($bob, sessionCreateScreensTeamPath($team));

    $memberPage->click('New session')
        ->assertVisible('#new-retro-title')
        ->assertNotPresent('#new-retro-save-template');

    $page = $this->signIn($olivia, sessionCreateScreensTeamPath($team));

    $page->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Harbour retro')
        ->click(SessionCreateScreensTemplates.' [role="radio"]:has-text("Start, Stop, Continue")')
        ->fill('[role="dialog"] [aria-label="Column 3 title"]', 'Keep going')
        ->click('#new-retro-save-template')
        ->assertAttribute('#new-retro-save-template', 'aria-checked', 'true')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header:has(h1) h1', 'Harbour retro');

    $template = WorkspaceTemplate::query()->where('name', 'Harbour retro')->sole();
    $retro = Retro::query()->where('title', 'Harbour retro')->sole();

    expect($template->workspace_id)->toBe($team->workspace_id)
        ->and($template->columns->pluck('title')->all())->toBe(['Start', 'Stop', 'Keep going'])
        ->and($retro->workspace_template_id)->toBe($template->id)
        ->and($retro->columns->pluck('title')->all())->toBe(['Start', 'Stop', 'Keep going']);
});

it('creates a game and a saved deck from a named deck, and a one-off deck without a name', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->assertNotPresent('button:has-text("New game")')
        ->click('button:has-text("New session")')
        ->click(SessionCreateScreensPokerType)
        ->assertVisible('#new-poker-title')
        ->fill('#new-poker-title', 'Named deck game')
        ->click('[role="dialog"] button:has-text("New deck")')
        ->assertNotPresent(SessionCreateScreensDecks)
        ->fill('#deck-custom-name', 'Halves')
        ->fill('#deck-custom-cards', '1, 2, 3')
        ->click('Use this deck')
        ->assertAttribute(SessionCreateScreensDecks.' [role="radio"]:has-text("Halves")', 'aria-checked', 'true')
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

    $page->navigate(sessionCreateScreensTeamPath($team))
        ->click('New session')
        ->click(SessionCreateScreensPokerType)
        ->assertVisible('#new-poker-title')
        ->assertSeeIn(SessionCreateScreensDecks.' [role="radio"]:has-text("Halves")', 'Saved')
        ->fill('#new-poker-title', 'One-off deck game')
        ->click('[role="dialog"] button:has-text("New deck")')
        ->fill('#deck-custom-cards', '5, 10')
        ->click('#deck-custom-coffee')
        ->click('Use this deck')
        ->assertAttribute(SessionCreateScreensDecks.' [role="radio"]:has-text("Custom deck")', 'aria-checked', 'true')
        ->assertSeeIn(SessionCreateScreensDecks.' [role="radio"]:has-text("Custom deck")', 'This game only')
        ->click('Create & open')
        ->assertPathBeginsWith('/poker/');

    $oneOff = PokerGame::query()->where('title', 'One-off deck game')->sole();

    expect($oneOff->cards)->toBe(['5', '10', '?'])
        ->and($oneOff->deck_name)->toBeNull()
        ->and(SavedPokerDeck::query()->count())->toBe(1);
});

it('starts the game with the three typed tasks as its queue, in order', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $queue = "[...document.querySelectorAll('[data-test=\"poker-task-row\"]')].map((row) => row.querySelector('span span').textContent).join(' / ')";

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->click('New session')
        ->click(SessionCreateScreensPokerType)
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

it('lets the creator arrive watching with "Watch only"', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->click('New session')
        ->click(SessionCreateScreensPokerType)
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

it('preselects the default deck of the team', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $deck = SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'name' => 'Team scale',
        'cards' => ['1', '2', '3', '5', '8', '?'],
        'created_by_user_id' => $alice->id,
    ]);
    $team->update(['default_saved_poker_deck_id' => $deck->id]);

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->click('New session')
        ->click(SessionCreateScreensPokerType)
        ->assertVisible('#new-poker-title')
        ->assertCount(SessionCreateScreensDecks.' [role="radio"]', 5)
        ->assertCount(SessionCreateScreensDecks.' [role="radio"][aria-checked="true"]', 1)
        ->assertSeeIn(SessionCreateScreensDecks.' [role="radio"][aria-checked="true"]', 'Team scale')
        ->fill('#new-poker-title', 'Default deck game')
        ->click('Create & open')
        ->assertPathBeginsWith('/poker/')
        ->assertSee('Team scale');

    $game = PokerGame::query()->where('title', 'Default deck game')->sole();

    expect($game->cards)->toBe(['1', '2', '3', '5', '8', '?'])
        ->and($game->deck_name)->toBe('Team scale');
});

it('shows the deck tiles, the "New deck" button and the Tasks block without scrolling at 1440 × 900', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');

    foreach (['Atlas hours', 'Team scale'] as $name) {
        SavedPokerDeck::factory()->create([
            'team_id' => $team->id,
            'name' => $name,
            'cards' => ['1', '2', '4', '8', '16', '?'],
            'created_by_user_id' => $alice->id,
        ]);
    }

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->resize(1440, 900)
        ->click('New session')
        ->click(SessionCreateScreensPokerType)
        ->assertVisible('#new-poker-title')
        ->assertPresent('[role="dialog"] [data-slot="deck-picker"][data-variant="compact"]')
        ->assertCount(SessionCreateScreensDecks.' [role="radio"]', 6)
        ->assertVisible('[role="dialog"] [data-slot="deck-create"]:has-text("New deck")')
        ->assertDontSeeIn('[role="dialog"]', 'Create a deck')
        ->assertSeeIn(SessionCreateScreensDecks.' [role="radio"]:has-text("Atlas hours") [data-slot="deck-values"]', '1 2 4 8 16 ?')
        ->assertScript('getComputedStyle(document.querySelector(\'[role="dialog"] [role="radio"] [data-slot="deck-values"]\')).fontFamily.includes("JetBrains Mono")', true)
        ->assertNotPresent('#new-poker-anonymous')
        ->assertDontSeeIn('[role="dialog"]', 'Anonymous votes')
        ->assertScript('(function () {
            const tasks = document.querySelector(\'[role="dialog"] [data-slot="poker-tasks"]\').getBoundingClientRect();
            const body = document.querySelector(\'[role="dialog"] [data-slot="session-dialog-body"]\');
            const footer = document.querySelector(\'[role="dialog"] [data-slot="session-dialog-footer"]\').getBoundingClientRect();

            return body.scrollTop === 0 && tasks.top >= 0 && tasks.height > 0 && tasks.bottom <= footer.top && tasks.bottom <= window.innerHeight;
        })()', true);
});

it('picks a whiteboard template with the arrows, and creates a board from a workspace template', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $template = WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Kick-off map',
        'scene' => ['elements' => [sceneElement(['id' => 'onlyElement', 'x' => 300, 'y' => 200])], 'files' => []],
        'created_by_user_id' => $alice->id,
    ]);
    $checked = SessionCreateScreensGallery.' [role="radio"][aria-checked="true"]';
    $workspaceTile = SessionCreateScreensGallery.' [role="radio"]:has(span:text-is("Kick-off map"))';
    $pressKey = fn (mixed $page, string $key): mixed => $page->script("() => { const radio = document.querySelector('".addslashes($checked)."'); radio.focus(); radio.dispatchEvent(new KeyboardEvent('keydown', { key: '{$key}', bubbles: true, cancelable: true })); return true; }");
    $releaseKey = fn (mixed $page, string $key): mixed => $page->script("() => { document.dispatchEvent(new KeyboardEvent('keyup', { key: '{$key}', bubbles: true })); return true; }");
    $storeBody = "(() => { const send = XMLHttpRequest.prototype.send; window.testBodies = []; XMLHttpRequest.prototype.send = function (body) { window.testBodies.push(typeof body === 'string' ? body : ''); return send.call(this, body); }; return true; })()";

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->click('New session')
        ->click(SessionCreateScreensWhiteboardType)
        ->assertVisible('#whiteboard-title')
        ->assertCount(SessionCreateScreensGallery, 2)
        ->assertCount($checked, 1)
        ->assertSeeIn($checked, 'Blank');

    $pressKey($page, 'ArrowRight');
    $page->assertSeeIn($checked, 'Brainstorm');
    $releaseKey($page, 'ArrowRight');

    $page->assertCount($checked, 1)
        ->assertSeeIn($checked, 'Brainstorm');

    $pressKey($page, 'ArrowLeft');
    $page->assertSeeIn($checked, 'Blank');
    $releaseKey($page, 'ArrowLeft');

    $page->assertCount($checked, 1)
        ->assertSeeIn($checked, 'Blank')
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

    $body = json_decode((string) $page->script("window.testBodies.find((body) => body.includes('From the workspace'))"), true);

    expect($body)->toHaveKey('workspace_template_id', $template->id)
        ->and($body)->not->toHaveKey('template');
});

it('keeps a whiteboard template when its deletion is cancelled in the confirmation dialog', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $template = WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Kick-off map',
        'created_by_user_id' => $alice->id,
    ]);
    $row = '[role="dialog"] li:has(p:text-is("Kick-off map"))';

    $page = $this->signIn($alice, route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'whiteboard'], false));

    $page->click('[data-slot="session-kind-links"] button:has-text("Whiteboard templates")')
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

it('offers five types, Poll among them, and opens the room of an icebreaker on the chosen game', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $icebreakerType = SessionCreateScreensTypes.' [role="radio"][data-type="icebreaker"]';
    $checked = SessionCreateScreensGames.' [role="radio"][aria-checked="true"]';

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->click('New session')
        ->assertCount(SessionCreateScreensTypes.' [role="radio"]', 5)
        ->assertPresent(SessionCreateScreensTypes.' [role="radio"][data-type="retro"]')
        ->assertPresent(SessionCreateScreensTypes.' [role="radio"][data-type="poker"]')
        ->assertPresent(SessionCreateScreensTypes.' [role="radio"][data-type="whiteboard"]')
        ->assertSeeIn(SessionCreateScreensTypes.' [role="radio"][data-type="survey"]', 'Poll')
        ->assertSeeIn($icebreakerType, 'Warm-up games')
        ->click($icebreakerType)
        ->assertAttribute($icebreakerType, 'aria-checked', 'true')
        ->assertVisible('#new-icebreaker-name')
        ->assertCount(SessionCreateScreensGames.' [role="radio"]', count(GameKind::cases()))
        ->assertCount($checked, 1)
        ->assertAttribute(SessionCreateScreensGames.' [role="radio"][data-game="gif"]', 'aria-disabled', 'true')
        ->assertSeeIn(SessionCreateScreensGames.' [role="radio"][data-game="gif"]', 'No GIF provider configured')
        ->click(SessionCreateScreensGames.' [role="radio"][data-game="hangman"]')
        ->assertCount($checked, 1)
        ->assertAttribute(SessionCreateScreensGames.' [role="radio"][data-game="hangman"]', 'aria-checked', 'true')
        ->fill('#new-icebreaker-name', 'Friday warm-up')
        ->click('#new-icebreaker-access')
        ->click('[role="option"]:has-text("Anyone with the link")')
        ->assertSeeIn('#new-icebreaker-access', 'Anyone with the link')
        ->click('Create & open')
        ->assertPathBeginsWith('/games/');

    $room = GameRoom::query()->sole();

    $page->assertPathIs("/games/{$room->id}")
        ->assertSeeIn('header:has(h1) h1', 'Friday warm-up')
        ->assertSee('Ready to play?');

    expect($room->name)->toBe('Friday warm-up')
        ->and($room->team_id)->toBe($team->id)
        ->and($room->game)->toBe(GameKind::Hangman)
        ->and($room->access)->toBe(GameRoomAccess::Link)
        ->and($room->host->user_id)->toBe($alice->id);
});

it('shows the Icebreaker type disabled with its reason when the team has reached the room limit', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $icebreakerType = SessionCreateScreensTypes.' [role="radio"][data-type="icebreaker"]';

    GameRoom::factory()->count(GameRoom::MaxRoomsPerTeam)->create(['team_id' => $team->id]);

    $page = $this->signIn($alice, sessionCreateScreensTeamPath($team));

    $page->click('New session')
        ->assertCount(SessionCreateScreensTypes.' [role="radio"]', 5)
        ->assertAttribute($icebreakerType, 'aria-disabled', 'true')
        ->assertSeeIn($icebreakerType, 'This team already has 10 game rooms.')
        ->assertAttribute($icebreakerType, 'aria-checked', 'false')
        ->assertNotPresent('#new-icebreaker-name')
        ->assertVisible('#new-retro-title');

    expect(GameRoom::query()->count())->toBe(GameRoom::MaxRoomsPerTeam);
});

function sessionCreateScreensDeckCard(string $name): string
{
    return '[data-slot="deck-card"]:has(h2:text-is("'.$name.'"))';
}

it('shows Edit and Delete on a saved deck to its creator and to a workspace admin, not to another member', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $bob = renamedUser(teamMember($team), 'Bob Stone');
    $admin = workspaceManager($team->workspace);
    $admin->update(['name' => 'Dana Admin', 'locale' => 'en']);
    SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'name' => 'Team scale',
        'cards' => ['1', '2', '3', '?'],
        'created_by_user_id' => $alice->id,
    ]);

    $this->signIn($alice, teamPath('teams.pokerDecks.index', $team))
        ->assertSeeIn(sessionCreateScreensDeckCard('Team scale'), 'Custom · by Alice Martin · 0 games')
        ->assertPresent('[aria-label="Edit Team scale"]')
        ->assertPresent('[aria-label="Delete Team scale"]')
        ->assertNotPresent('[aria-label="Edit Fibonacci"]')
        ->assertSeeIn(sessionCreateScreensDeckCard('Fibonacci'), 'Built-in');

    $this->signIn($bob, teamPath('teams.pokerDecks.index', $team))
        ->assertSeeIn(sessionCreateScreensDeckCard('Team scale'), 'Team scale')
        ->assertPresent('[aria-label="Duplicate Team scale"]')
        ->assertNotPresent('[aria-label="Edit Team scale"]')
        ->assertNotPresent('[aria-label="Delete Team scale"]');

    $this->signIn($admin, teamPath('teams.pokerDecks.index', $team))
        ->assertPresent('[aria-label="Edit Team scale"]')
        ->assertPresent('[aria-label="Delete Team scale"]');
});

it('moves the Default badge with "Set as default" and preselects that deck in the new session dialog', function () {
    $team = Team::factory()->create();
    $admin = integrationAdmin($team);
    $admin->update(['name' => 'Dana Admin', 'locale' => 'en']);
    $member = renamedUser(teamMember($team), 'Alice Martin');
    $deck = SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'name' => 'Team scale',
        'cards' => ['1', '2', '3', '5', '8', '?'],
        'created_by_user_id' => $member->id,
    ]);

    $this->signIn($member, teamPath('teams.pokerDecks.index', $team))
        ->assertSeeIn(sessionCreateScreensDeckCard('Fibonacci'), 'Default')
        ->assertNotPresent('[aria-label="Set Team scale as default"]');

    $page = $this->signIn($admin, teamPath('teams.pokerDecks.index', $team));

    $page->assertCount('[data-slot="deck-card"][data-default]', 1)
        ->assertSeeIn(sessionCreateScreensDeckCard('Fibonacci'), 'Default')
        ->assertNotPresent('[aria-label="Set Fibonacci as default"]')
        ->click('[aria-label="Set T-shirt sizes as default"]')
        ->assertSeeIn(sessionCreateScreensDeckCard('T-shirt sizes'), 'Default')
        ->assertCount('[data-slot="deck-card"][data-default]', 1)
        ->assertPresent('[aria-label="Set Fibonacci as default"]');

    expect($team->fresh()->default_poker_deck)->toBe('tshirt');

    $page->click('[aria-label="Set Team scale as default"]')
        ->assertSeeIn(sessionCreateScreensDeckCard('Team scale'), 'Default')
        ->assertCount('[data-slot="deck-card"][data-default]', 1);

    expect($team->fresh()->default_saved_poker_deck_id)->toBe($deck->id)
        ->and($team->fresh()->default_poker_deck)->toBeNull();

    $page->click('[data-sidebar="content"] a[data-sidebar="menu-button"][aria-label="Home"]')
        ->assertPathIs(sessionCreateScreensTeamPath($team))
        ->click('[data-slot="team-header"] button:has-text("New session")')
        ->click(SessionCreateScreensPokerType)
        ->assertVisible('#new-poker-title')
        ->assertCount(SessionCreateScreensDecks.' [role="radio"][aria-checked="true"]', 1)
        ->assertSeeIn(SessionCreateScreensDecks.' [role="radio"][aria-checked="true"]', 'Team scale');
});

it('duplicates a built-in deck and a saved deck as decks of the team', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $bob = renamedUser(teamMember($team), 'Bob Stone');
    SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'name' => 'Team scale',
        'cards' => ['1', '2', '3', '?'],
        'created_by_user_id' => $bob->id,
    ]);

    $page = $this->signIn($alice, teamPath('teams.pokerDecks.index', $team));

    $page->assertCount('[data-slot="deck-card"]', 5)
        ->click('[aria-label="Duplicate Fibonacci"]')
        ->assertSeeIn('[data-slot="saved-decks-grid"]', 'Copy of Fibonacci')
        ->assertSeeIn(sessionCreateScreensDeckCard('Copy of Fibonacci'), 'Custom · by Alice Martin · 0 games')
        ->assertPresent('[aria-label="Edit Copy of Fibonacci"]')
        ->click('[aria-label="Duplicate Team scale"]')
        ->assertSeeIn('[data-slot="saved-decks-grid"]', 'Copy of Team scale')
        ->click('[aria-label="Duplicate Fibonacci"]')
        ->assertSeeIn('[data-slot="saved-decks-grid"]', 'Copy of Fibonacci 2')
        ->assertCount('[data-slot="deck-card"]', 8);

    $decks = $team->pokerDecks()->get()->keyBy('name');

    expect($decks->keys()->sort()->values()->all())->toBe(['Copy of Fibonacci', 'Copy of Fibonacci 2', 'Copy of Team scale', 'Team scale'])
        ->and($decks['Copy of Fibonacci']->cards)->toBe(['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕'])
        ->and($decks['Copy of Fibonacci']->created_by_user_id)->toBe($alice->id)
        ->and($decks['Copy of Team scale']->cards)->toBe(['1', '2', '3', '?']);
});

it('raises the usage count of a deck after a game is created from it', function () {
    $team = Team::factory()->create();
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'name' => 'Team scale',
        'cards' => ['1', '2', '3', '?'],
        'created_by_user_id' => $alice->id,
    ]);

    $page = $this->signIn($alice, teamPath('teams.pokerDecks.index', $team));

    $page->assertSeeIn(sessionCreateScreensDeckCard('Team scale'), '0 games')
        ->assertSeeIn(sessionCreateScreensDeckCard('Fibonacci'), '13 values · 0 games')
        ->click('[data-sidebar="content"] a[data-sidebar="menu-button"][aria-label="Home"]')
        ->assertPathIs(sessionCreateScreensTeamPath($team))
        ->click('[data-slot="team-header"] button:has-text("New session")')
        ->click(SessionCreateScreensPokerType)
        ->assertVisible('#new-poker-title')
        ->fill('#new-poker-title', 'Counted game')
        ->click(SessionCreateScreensDecks.' [role="radio"]:has-text("Team scale")')
        ->click('Create & open')
        ->assertPathBeginsWith('/poker/')
        ->navigate(teamPath('teams.pokerDecks.index', $team))
        ->assertSeeIn(sessionCreateScreensDeckCard('Team scale'), 'Custom · by Alice Martin · 1 game')
        ->assertSeeIn(sessionCreateScreensDeckCard('Fibonacci'), '13 values · 0 games');
});
