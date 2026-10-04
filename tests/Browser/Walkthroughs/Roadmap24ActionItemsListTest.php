<?php

use App\Enums\ActionItemPriority;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSprint;
use App\Models\User;

function r24lMember(Team $team, string $name, string $locale = 'en'): User
{
    $user = teamMember($team);

    $user->update(['name' => $name, 'locale' => $locale]);

    return $user;
}

/**
 * @param  array<string, mixed>  $attributes
 */
function r24lItem(Team $team, User $author, string $content, array $attributes = []): ActionItem
{
    return ActionItem::factory()
        ->withoutRetro($team, $author)
        ->create(['content' => $content, ...$attributes]);
}

function r24lPath(Team $team, string $query = ''): string
{
    $path = route('workspaces.actionItems.index', ['workspace' => $team->workspace], false);

    return $query === '' ? $path : "{$path}?{$query}";
}

function r24lRow(ActionItem $item): string
{
    return "#action-item-{$item->id}";
}

function r24lFacet(string $label): string
{
    return "[data-slot=\"action-item-filters\"] [aria-label=\"{$label}\"]";
}

function r24lChoose(mixed $page, string $trigger, string $option): void
{
    $page->click($trigger)
        ->assertPresent('[role="listbox"]')
        ->click("[role=\"option\"]:has-text(\"{$option}\")")
        ->assertNotPresent('[role="listbox"]');
}

function r24lSearch(): string
{
    return '[data-slot="action-items-page"] input[aria-label="Search action items"], header input[aria-label="Search action items"]';
}

/**
 * @return array{
 *     0: Team,
 *     1: User,
 *     2: ActionItem,
 *     3: ActionItem,
 *     4: ActionItem
 * }
 */
function r24lFacetedTeam(): array
{
    $team = Team::factory()->create(['name' => 'Platform']);
    $alice = r24lMember($team, 'Alice Martin');
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'title' => 'Sprint 11', 'completed_at' => now()]);
    $fromRetro = ActionItem::factory()->priority(ActionItemPriority::High)->create([
        'retro_id' => $retro->id,
        'content' => 'Rotate the keys',
        'due_on' => ActionItem::today()->addDays(2)->toDateString(),
    ]);
    $later = r24lItem($team, $alice, 'Book the room', [
        'priority' => ActionItemPriority::Low,
        'due_on' => ActionItem::today()->addDays(20)->toDateString(),
    ]);
    $overdue = r24lItem($team, $alice, 'Archive the old board', [
        'assignee_user_id' => $alice->id,
        'due_on' => ActionItem::today()->subDays(2)->toDateString(),
    ]);

    return [$team, $alice, $fromRetro, $later, $overdue];
}

it('[R24-05] narrows the list by priority, due date and source, writes them to the URL and resets them', function () {
    [$team, $alice, $fromRetro, $later, $overdue] = r24lFacetedTeam();

    $page = $this->signIn($alice, r24lPath($team))->resize(1440, 900);

    $page->assertCount('tr[data-slot="action-row"]', 3)
        ->assertNotPresent('[data-slot="action-item-filters"] button:has-text("Reset")');

    $this->toggleListboxOption($page, r24lFacet('Priority'), 'High');
    $page->assertQueryStringHas('priority', 'high')
        ->assertSeeIn(r24lFacet('Priority'), 'High')
        ->assertPresent(r24lRow($fromRetro))
        ->assertNotPresent(r24lRow($later))
        ->assertNotPresent(r24lRow($overdue));

    $this->toggleListboxOption($page, r24lFacet('Priority'), 'Low');
    $page->assertQueryStringHas('priority', 'high,low')
        ->assertSeeIn(r24lFacet('Priority'), '2 of 3')
        ->assertPresent(r24lRow($later))
        ->click('[data-slot="action-item-filters"] [aria-label="Clear priority"]')
        ->assertQueryStringMissing('priority')
        ->assertCount('tr[data-slot="action-row"]', 3);

    r24lChoose($page, r24lFacet('Due date'), 'Next 7 days');
    $page->assertQueryStringHas('due', 'week')
        ->assertSeeIn(r24lFacet('Due date'), 'Next 7 days')
        ->assertPresent(r24lRow($fromRetro))
        ->assertCount('tr[data-slot="action-row"]', 1);

    r24lChoose($page, r24lFacet('Due date'), 'Overdue');
    $page->assertQueryStringHas('due', 'overdue')
        ->assertAttribute('[data-slot="action-filter-overdue"]', 'aria-pressed', 'true')
        ->assertPresent(r24lRow($overdue))
        ->assertCount('tr[data-slot="action-row"]', 1)
        ->click('[data-slot="action-filter-overdue"]')
        ->assertQueryStringMissing('due')
        ->assertCount('tr[data-slot="action-row"]', 3);

    r24lChoose($page, r24lFacet('Source'), 'From a retro');
    $page->assertQueryStringHas('source', 'retro')
        ->assertPresent(r24lRow($fromRetro))
        ->assertCount('tr[data-slot="action-row"]', 1);

    r24lChoose($page, r24lFacet('Source'), 'Added outside a retro');
    $page->assertQueryStringHas('source', 'outside')
        ->assertNotPresent(r24lRow($fromRetro))
        ->assertCount('tr[data-slot="action-row"]', 2);

    $this->toggleListboxOption($page, r24lFacet('Priority'), 'Medium');
    r24lChoose($page, r24lFacet('Due date'), 'Later');
    $page->assertSee('Nothing matches these filters.')
        ->click('[data-slot="action-item-filters"] button:has-text("Reset")')
        ->assertQueryStringMissing('priority')
        ->assertQueryStringMissing('due')
        ->assertQueryStringMissing('source')
        ->assertCount('tr[data-slot="action-row"]', 3)
        ->assertNoJavaScriptErrors();
});

it('[R24-05b] ticks priorities from the keyboard: Enter opens the list, the arrows move and Enter ticks', function () {
    [$team, $alice, $fromRetro, $later, $overdue] = r24lFacetedTeam();

    $page = $this->signIn($alice, r24lPath($team))->resize(1440, 900);

    $page->assertCount('tr[data-slot="action-row"]', 3)
        ->keys(r24lFacet('Priority'), 'Enter')
        ->assertPresent('[role="listbox"][aria-label="Priority"]')
        ->assertScript('document.querySelector(\'[data-slot="action-item-filters"] [role="combobox"][aria-label="Priority"]\').getAttribute("aria-controls") === document.querySelector(\'[role="listbox"][aria-label="Priority"]\').id', true)
        ->assertScript('document.activeElement === document.querySelector(\'[role="listbox"][aria-label="Priority"]\')', true)
        ->withKeyDown('Enter', fn ($page) => $page)
        ->assertQueryStringHas('priority', 'high')
        ->withKeyDown('ArrowDown', fn ($page) => $page)
        ->withKeyDown('ArrowDown', fn ($page) => $page)
        ->assertScript('document.activeElement.getAttribute("aria-activedescendant") === document.querySelector(\'[role="option"][aria-selected="true"]\').id', true)
        ->withKeyDown('Enter', fn ($page) => $page)
        ->assertQueryStringHas('priority', 'high,low')
        ->assertPresent(r24lRow($fromRetro))
        ->assertPresent(r24lRow($later))
        ->assertNotPresent(r24lRow($overdue))
        ->withKeyDown('Escape', fn ($page) => $page)
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn(r24lFacet('Priority'), '2 of 3')
        ->assertNoJavaScriptErrors();
});

it('[R24-06] searches the text and the ticket keys from the topbar field, with the delay, Enter, Escape and the shortcut', function () {
    [$team, $alice, $fromRetro, $later, $overdue] = r24lFacetedTeam();
    ActionItemExternalLink::factory()->create(['action_item_id' => $later->id, 'external_key' => 'PROJ-12']);
    $search = 'input[aria-label="Search action items"]';

    $page = $this->signIn($alice, r24lPath($team))->resize(1440, 900);

    $page->assertAttribute($search, 'placeholder', 'Search an action item, a ticket…')
        ->assertSeeIn('[data-slot="action-item-search"] kbd', 'K')
        ->type($search, 'ROTATE')
        ->assertQueryStringHas('q', 'ROTATE')
        ->assertPresent(r24lRow($fromRetro))
        ->assertCount('tr[data-slot="action-row"]', 1)
        ->assertPresent('[data-slot="action-item-filters"] button:has-text("Reset")')
        ->type($search, 'proj-12')
        ->keys($search, 'Enter')
        ->assertQueryStringHas('q', 'proj-12')
        ->assertPresent(r24lRow($later))
        ->assertCount('tr[data-slot="action-row"]', 1)
        ->keys($search, 'Escape')
        ->assertValue($search, '')
        ->assertQueryStringMissing('q')
        ->assertCount('tr[data-slot="action-row"]', 3)
        ->type($search, 'nothing like this')
        ->assertSee('Nothing matches these filters.')
        ->click('[data-slot="action-item-filters"] button:has-text("Reset")')
        ->assertQueryStringMissing('q')
        ->assertValue($search, '')
        ->click('[data-slot="action-items-header"] h1')
        ->keys('[data-slot="action-items-header"] h1', 'ControlOrMeta+k')
        ->assertScript('document.activeElement?.getAttribute("aria-label")', 'Search action items')
        ->assertNotPresent('[role="dialog"]')
        ->assertNoJavaScriptErrors();

    $page->navigate(r24lPath($team, 'q=archive'))
        ->assertValue($search, 'archive')
        ->assertPresent(r24lRow($overdue))
        ->assertCount('tr[data-slot="action-row"]', 1);
});

it('[R24-07] groups the rows by sprint by default, latest first, with the state, the counts and the rows outside every sprint', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $alice = r24lMember($team, 'Alice Martin');
    $today = ActionItem::today();
    TeamSprint::factory()->create(['team_id' => $team->id, 'number' => 42, 'starts_on' => $today->subDays(3)->toDateString(), 'ends_on' => $today->addDays(10)->toDateString()]);
    TeamSprint::factory()->create(['team_id' => $team->id, 'number' => 41, 'starts_on' => $today->subDays(20)->toDateString(), 'ends_on' => $today->subDays(7)->toDateString()]);
    $current = r24lItem($team, $alice, 'Rotate the keys', ['created_at' => $today->subDay()->setTime(10, 0)]);
    $carried = r24lItem($team, $alice, 'Archive the old board', ['created_at' => $today->subDays(15)->setTime(10, 0), 'due_on' => $today->subDays(8)->toDateString()]);
    $between = r24lItem($team, $alice, 'Book the room', ['created_at' => $today->subDays(5)->setTime(10, 0)]);
    $groups = 'Array.from(document.querySelectorAll(\'tr[data-slot="action-group"]\')).map((row) => row.innerText.replace(/\s+/g, " ").trim()).join(" | ")';
    $startsOn = $today->subDays(3)->format('M j');
    $endsOn = $today->addDays(10)->format('M j');

    $page = $this->signIn($alice, r24lPath($team))->resize(1440, 900);

    $page->assertAttribute('[data-slot="action-items-header"] button:has-text("Sprint")', 'aria-checked', 'true')
        ->assertScript($groups, "Sprint 42 In progress 1 action item · {$startsOn} → {$endsOn} | Sprint 41 Finished 1 carried over 1 overdue | No sprint 1 action item")
        ->assertScript("document.querySelector('".r24lRow($current)."').compareDocumentPosition(document.querySelector('".r24lRow($carried)."')) & Node.DOCUMENT_POSITION_FOLLOWING", 4)
        ->assertPresent(r24lRow($between))
        ->click('tr[data-slot="action-group"]:has-text("Sprint 41") button[aria-expanded="true"]')
        ->assertNotPresent(r24lRow($carried))
        ->click('[data-slot="action-items-header"] button:has-text("None")')
        ->assertCount('tr[data-slot="action-group"]', 0)
        ->assertPresent(r24lRow($carried))
        ->click('[data-slot="action-item-filters"] button:has-text("Reset")')
        ->assertAttribute('[data-slot="action-items-header"] button:has-text("Sprint")', 'aria-checked', 'true')
        ->assertCount('tr[data-slot="action-group"]', 3)
        ->assertNoJavaScriptErrors();
});

it('[R24-08] exports the filtered list, every page of it, as a CSV file', function () {
    [$team, $alice, $fromRetro, $later, $overdue] = r24lFacetedTeam();
    ActionItem::factory()->withoutRetro($team, $alice)->count(50)->create(['priority' => ActionItemPriority::High]);
    $export = '[data-slot="export-action-items"]';
    $download = 'Array.from(document.querySelectorAll(\'[data-slot="export-action-items"]\')).map((link) => link.getAttribute("href")).join(" ")';
    $csv = "() => fetch(document.querySelector('[data-slot=\"export-action-items\"]').href).then((response) => response.text().then((body) => JSON.stringify({ type: response.headers.get('content-type'), disposition: response.headers.get('content-disposition'), body })))";

    $page = $this->signIn($alice, r24lPath($team))->resize(1440, 900);

    $page->assertSeeIn($export, 'Export')
        ->assertPresent("{$export}[download]");

    $this->toggleListboxOption($page, r24lFacet('Priority'), 'High');
    $page->assertQueryStringHas('priority', 'high')
        ->assertScript("{$download}.includes('priority=high')", true);

    $answer = json_decode((string) $page->script($csv), true, flags: JSON_THROW_ON_ERROR);
    $rows = array_map(str_getcsv(...), array_filter(preg_split('/\r?\n/', ltrim($answer['body'], "\u{FEFF}"))));

    expect($answer['type'])->toStartWith('text/csv')
        ->and($answer['disposition'])->toContain("action-items-{$team->workspace->slug}-")
        ->and($rows[0])->toBe(['Action', 'Status', 'Team', 'Assignee', 'Priority', 'Due date', 'Source', 'Created', 'Completed', 'Tickets', 'Link'])
        ->and($rows)->toHaveCount(52)
        ->and(array_unique(array_column(array_slice($rows, 1), 4)))->toBe(['High'])
        ->and(array_column(array_slice($rows, 1), 0))->toContain('Rotate the keys')
        ->and(array_column(array_slice($rows, 1), 0))->not->toContain('Book the room');
});

it('[R24-09] sets the three statuses from the row badge and from the side sheet, which names the start day', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $alice = r24lMember($team, 'Alice Martin');
    $item = r24lItem($team, $alice, 'Rotate the keys');
    $row = r24lRow($item);
    $sheet = '[data-slot="action-sheet"]';
    $status = "{$row} [data-slot=\"action-row-status\"]";

    $page = $this->signIn($alice, r24lPath($team, 'status=todo,doing,completed'))->resize(1440, 900);

    $page->assertSeeIn($status, 'To do')
        ->assertAttribute($status, 'aria-label', 'Mark as in progress')
        ->click($status)
        ->assertAttribute($row, 'data-status', 'doing')
        ->assertSeeIn($status, 'In progress')
        ->click($status)
        ->assertAttribute($row, 'data-status', 'completed')
        ->assertSeeIn($status, 'Done')
        ->assertAttribute($status, 'aria-label', 'Reopen')
        ->click("{$row} [data-slot=\"action-row-title\"]")
        ->assertSeeIn("{$sheet} [aria-label=\"Status\"]", 'Done');

    r24lChoose($page, "{$sheet} [aria-label=\"Status\"]", 'In progress');
    $page->assertSeeIn("{$sheet} [aria-label=\"Status\"]", 'In progress')
        ->assertSeeIn($sheet, 'Started ')
        ->assertAttribute($row, 'data-status', 'doing')
        ->click("{$sheet} button:has-text(\"Mark as done\")")
        ->assertAttribute($row, 'data-status', 'completed');

    r24lChoose($page, "{$sheet} [aria-label=\"Status\"]", 'To do');
    $page->assertAttribute($row, 'data-status', 'open')
        ->assertDontSeeIn($sheet, 'Started ')
        ->assertNoJavaScriptErrors();

    expect($item->fresh()->completed_at)->toBeNull()
        ->and($item->fresh()->started_at)->toBeNull();
});

it('[R24-10] lists the actions at phone width without overflow, enters selection with the Select button and docks a bar of three actions and more', function () {
    [$team, $alice] = r24lFacetedTeam();
    $bar = '[role="toolbar"][aria-label="Bulk actions"]';

    $page = $this->signIn($alice, r24lPath($team))->resize(390, 844);

    $page->assertPresent('[data-slot="action-items-list"]')
        ->assertNotPresent('[data-slot="action-items-table"]')
        ->assertNotPresent('header input[aria-label="Search action items"]')
        ->assertPresent('button:has-text("Filters")')
        ->assertCount('[data-slot="action-items-list"] [id^="action-item-"]:not([id*="-comments"])', 3);

    expect($this->overflowingElements($page))->toBe([]);

    $page->click('[data-slot="action-items-select-mode"]')
        ->assertSeeIn('[data-slot="action-items-select-mode"]', 'Finish selecting')
        ->assertCount('[data-slot="action-item-selectable"]', 3)
        ->click('[role="checkbox"][aria-label="Select Book the room"]')
        ->assertAttribute($bar, 'data-layout', 'docked')
        ->assertSeeIn($bar, '1 selected')
        ->assertPresent("{$bar} button:has-text(\"Status\")")
        ->assertPresent("{$bar} button:has-text(\"Assign\")")
        ->assertPresent("{$bar} button:has-text(\"Due date\")")
        ->assertPresent("{$bar} [aria-label=\"More actions\"]")
        ->assertNotPresent("{$bar} button:has-text(\"Priority\")")
        ->click("{$bar} [aria-label=\"More actions\"]")
        ->assertPresent('[role="menu"] [role="menuitem"]:has-text("Delete")')
        ->assertPresent('[role="menu"] [role="menuitem"]:has-text("Priority")')
        ->keys('[role="menu"]', 'Escape');

    expect($this->overflowingElements($page))->toBe([]);

    $page->click('button:has-text("Filters")')
        ->assertPresent('[role="dialog"] input[aria-label="Search action items"]')
        ->assertNoJavaScriptErrors();
});

it('[R24-11] draws the actions page in the dark theme without overflow, and light again in the light theme', function () {
    [$team, $alice] = r24lFacetedTeam();
    $tableLightness = '() => { const background = getComputedStyle(document.querySelector(\'[data-slot="action-items-table"]\')).backgroundColor; const oklch = background.match(/oklch\\(([\\d.]+)/); if (oklch) { return parseFloat(oklch[1]); } const [r, g, b] = background.match(/[\\d.]+/g).map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }';

    $page = $this->signIn($alice, '/settings/appearance');

    $page->click('[role="radio"]:has-text("Dark")')
        ->assertScript('document.documentElement.classList.contains("dark")', true)
        ->navigate(r24lPath($team))
        ->resize(1440, 900)
        ->assertScript('document.documentElement.classList.contains("dark")', true)
        ->assertPresent('[data-slot="action-items-table"]')
        ->click('[role="checkbox"][aria-label="Select Book the room"]')
        ->assertPresent('[role="toolbar"][aria-label="Bulk actions"]');

    $darkLightness = (float) $page->script($tableLightness);
    $darkOverflow = $this->overflowingElements($page);

    $page->navigate('/settings/appearance')
        ->click('[role="radio"]:has-text("Light")')
        ->assertScript('document.documentElement.classList.contains("dark")', false)
        ->navigate(r24lPath($team))
        ->assertPresent('[data-slot="action-items-table"]');

    $lightLightness = (float) $page->script($tableLightness);

    expect($darkLightness)->toBeLessThan(0.3)
        ->and($lightLightness)->toBeGreaterThan(0.7)
        ->and($darkOverflow)->toBe([]);

    $page->assertNoJavaScriptErrors();
});

it('[R24-12] speaks the language of the member on the actions page, English and informal French', function () {
    [$team, $alice] = r24lFacetedTeam();
    $claire = r24lMember($team, 'Claire Dupont', 'fr');
    $path = r24lPath($team);

    $page = $this->signIn($alice, $path)->resize(1440, 900);

    $page->assertScript('document.documentElement.lang', 'en')
        ->assertSeeIn('[data-slot="action-items-header"] h1', 'Action items')
        ->assertAttribute('input[aria-label="Search action items"]', 'placeholder', 'Search an action item, a ticket…')
        ->assertSeeIn('[data-slot="action-items-counts"]', '3 open · 1 overdue · from 1 ritual')
        ->assertSeeIn('[data-slot="action-items-header"]', 'Group by')
        ->assertSeeIn('[data-sidebar="menu-badge"]', '1 overdue')
        ->assertSeeIn('[data-slot="export-action-items"]', 'Export')
        ->assertSee('New action item');

    $page = $this->signIn($claire, $path)->resize(1440, 900);

    $page->assertScript('document.documentElement.lang', 'fr')
        ->assertSeeIn('[data-slot="action-items-header"] h1', 'Actions')
        ->assertAttribute('input[aria-label="Rechercher des actions"]', 'placeholder', 'Rechercher une action, un ticket…')
        ->assertSeeIn('[data-slot="action-items-header"]', 'Grouper par')
        ->assertSeeIn('[data-slot="action-items-counts"]', '3 ouvertes · 1 en retard · issues d’un rituel')
        ->assertSeeIn('[data-slot="export-action-items"]', 'Exporter')
        ->assertNoJavaScriptErrors();
});
