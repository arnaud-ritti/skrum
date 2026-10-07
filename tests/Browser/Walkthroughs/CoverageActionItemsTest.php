<?php

use App\Enums\ActionItemPriority;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\TeamSprint;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\InteractsWithIntegrations;

pest()->use(InteractsWithIntegrations::class);

it('renders the actions page to a team member, hides the items of another team, refuses another workspace with 403 and sends a visitor to the login', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $item = teamActionItem($team, $alice, 'Rotate the keys');
    $borealis = Team::factory()->for($team->workspace)->create(['name' => 'Borealis']);
    $bob = renamedUser(teamMember($borealis), 'Bob Stone');
    $outsider = renamedUser(teamMember(Team::factory()->create(['name' => 'Elsewhere'])), 'Olga Outsider');
    $path = workspaceActionItemsPath($team);

    $this->signIn($alice, $path)
        ->assertPresent('[data-slot="action-items-page"]')
        ->assertSeeIn(actionItemRow($item), 'Rotate the keys')
        ->assertNoJavaScriptErrors();

    $this->signIn($bob, workspaceActionItemsPath($team, "item={$item->id}"))
        ->assertPresent('[data-slot="action-items-page"]')
        ->assertNotPresent(actionItemRow($item))
        ->assertNotPresent('[data-slot="action-sheet"]')
        ->assertDontSee('Rotate the keys')
        ->assertNoJavaScriptErrors();

    $this->signIn($outsider, $path)
        ->assertPresent('[data-slot="error-page"][data-status="403"]')
        ->assertNotPresent('[data-slot="action-items-page"]');

    browserVisit($path)->assertPathIs('/login');
});

it('disables the offer to select every matching item above 500 with the reason', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    ActionItem::factory()->withoutRetro($team, $alice)->count(501)->create();
    $bar = bulkActionsBar();
    $offer = "{$bar} [data-slot=\"bulk-select-matching\"]";

    $page = $this->signIn($alice, workspaceActionItemsPath($team))->resize(1440, 900);

    $page->click('[data-slot="action-select-all"]')
        ->assertSeeIn($bar, '50 selected')
        ->assertSeeIn($offer, 'Select all 501 matching')
        ->assertAttribute($offer, 'aria-disabled', 'true')
        ->hover($offer)
        ->assertSeeIn('[role="tooltip"]', 'Up to 500 at once. Narrow the filters.')
        ->assertSeeIn($bar, '50 selected')
        ->assertDontSeeIn($bar, 'matching selected')
        ->assertNoJavaScriptErrors();
});

it('keeps every matching item selected on the next page and clears the selection on a filter change', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    ActionItem::factory()->withoutRetro($team, $alice)->count(55)->create(['priority' => ActionItemPriority::High]);
    $bar = bulkActionsBar();
    $offer = "{$bar} [data-slot=\"bulk-select-matching\"]";

    $page = $this->signIn($alice, workspaceActionItemsPath($team))->resize(1440, 900);

    $page->click('[data-slot="action-select-all"]')
        ->click($offer)
        ->assertSeeIn($bar, 'All 55 matching selected')
        ->click('[data-slot="action-items-pagination"] [aria-label="Next page"]')
        ->assertQueryStringHas('page', '2')
        ->assertCount('tr[data-slot="action-row"]', 5)
        ->assertSeeIn($bar, 'All 55 matching selected')
        ->assertCount('tr[data-slot="action-row"] [role="checkbox"][aria-checked="true"]', 5);

    $this->toggleListboxOption($page, '[data-slot="action-item-filters"] [aria-label="Priority"]', 'High');

    $page->assertQueryStringHas('priority', 'high')
        ->assertNotPresent($bar)
        ->assertCount('tr[data-slot="action-row"] [role="checkbox"][aria-checked="true"]', 0)
        ->assertNoJavaScriptErrors();
});

it('enters selection mode with the item selected on a long press at phone width, and leaves a short tap out of selection', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $room = teamActionItem($team, $alice, 'Book the room');
    teamActionItem($team, $alice, 'Rotate the keys');
    $bar = bulkActionsBar();
    $press = fn (string $type) => "() => { const item = document.querySelector('[data-slot=\"action-items-list\"] #action-item-{$room->id} [data-slot=\"action-item-selectable\"], [data-slot=\"action-items-list\"] #action-item-{$room->id}'); const box = item.getBoundingClientRect(); item.dispatchEvent(new PointerEvent('{$type}', { bubbles: true, pointerType: 'touch', isPrimary: true, clientX: box.left + 40, clientY: box.top + 10 })); return true; }";

    $page = $this->signIn($alice, workspaceActionItemsPath($team))->resize(390, 844);

    $page->assertPresent('[data-slot="action-items-list"]')
        ->assertNotPresent($bar);

    $page->script($press('pointerdown'));

    $page->assertSeeIn($bar, '1 selected')
        ->assertAttribute(selectCheckbox('Book the room'), 'aria-checked', 'true')
        ->assertAttribute(selectCheckbox('Rotate the keys'), 'aria-checked', 'false')
        ->assertSeeIn('[data-slot="action-items-select-mode"]', 'Finish selecting');

    $page->script($press('pointerup'));

    $page->click('[data-slot="action-items-select-mode"]')
        ->assertNotPresent($bar)
        ->assertSeeIn('[data-slot="action-items-select-mode"]', 'Select');

    $page->script($press('pointerdown'));
    $page->script($press('pointerup'));

    $page->click("[data-slot=\"action-items-list\"] #action-item-{$room->id} >> text=Book the room")
        ->assertNotPresent($bar)
        ->assertNotPresent('[data-slot="action-item-selectable"]')
        ->assertDontSeeIn('[data-slot="action-items-select-mode"]', 'Finish selecting')
        ->assertNoJavaScriptErrors();
});

it('stops syncing the selection to Jira at the first answer asking to reconnect', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    teamActionItem($team, $alice, 'Rotate the keys');
    teamActionItem($team, $alice, 'Book the room');
    teamActionItem($team, $alice, 'Ship the beta');
    $issues = 0;
    Http::fake([
        jiraApiUrl('rest/api/3/priority/search*') => Http::response(['values' => [['id' => '3', 'name' => 'Medium']]]),
        jiraApiUrl('rest/api/3/project/search*') => Http::response(['values' => [['id' => '10000', 'key' => 'PROJ', 'name' => 'Project']]]),
        jiraApiUrl('rest/api/3/issuetype/project*') => Http::response([['id' => '11', 'name' => 'Task', 'subtask' => false]]),
        jiraApiUrl('rest/api/3/issue/createmeta/*') => Http::response(jiraCreateMeta(priorities: [['id' => '3', 'name' => 'Medium']])),
        jiraApiUrl('rest/api/3/issue') => function () use (&$issues) {
            $issues++;

            return Http::response(['message' => 'Unauthorized'], 401);
        },
        'auth.atlassian.com/oauth/token' => Http::response(['error' => 'invalid_grant'], 400),
        'api.atlassian.com/*' => Http::response(['errorMessages' => ['Unexpected request in a browser test.']], 404),
    ]);
    $bar = bulkActionsBar();
    $dialog = '[data-slot="bulk-sync-dialog"]';

    $page = $this->signIn($alice, workspaceActionItemsPath($team))->resize(1440, 900);

    $page->click('[data-slot="action-select-all"]')
        ->assertSeeIn($bar, '3 selected')
        ->click("{$bar} button:has-text(\"Sync to Jira\")")
        ->assertSeeIn($dialog, 'Export 3 items')
        ->click("{$dialog} button:has-text(\"Export 3 items\")")
        ->assertSee('0 exported, 0 already linked, 3 failed.')
        ->click('[data-sonner-toast] button:has-text("Details")')
        ->assertSeeIn('[role="dialog"] [data-slot="bulk-refusals"]', 'Reconnect Jira in the team settings.')
        ->assertCount('[role="dialog"] [data-slot="bulk-refusals"] li:has-text("Not sent: the export was stopped.")', 2)
        ->assertNotPresent('[data-slot="action-row-ticket"] a')
        ->assertNoJavaScriptErrors();

    expect($issues)->toBe(1);
});

it('offers the groupings in the order of the mockup, keeps a stored choice, and names the team of each sprint when the page spans two teams', function () {
    $platform = Team::factory()->create(['name' => 'Platform']);
    $alice = renamedUser(teamMember($platform), 'Alice Martin');
    $atlas = Team::factory()->for($platform->workspace)->create(['name' => 'Atlas']);
    $atlas->members()->attach($alice->id, ['role' => TeamRole::Member->value]);
    $today = ActionItem::today();
    TeamSprint::factory()->create(['team_id' => $platform->id, 'number' => 7, 'starts_on' => $today->subDays(3)->toDateString(), 'ends_on' => $today->addDays(10)->toDateString()]);
    TeamSprint::factory()->create(['team_id' => $atlas->id, 'number' => 42, 'starts_on' => $today->subDays(3)->toDateString(), 'ends_on' => $today->addDays(10)->toDateString()]);
    teamActionItem($platform, $alice, 'Rotate the keys', ['created_at' => $today->subDay()->setTime(10, 0)]);
    teamActionItem($atlas, $alice, 'Book the room', ['created_at' => $today->subDay()->setTime(11, 0)]);
    $segments = 'Array.from(document.querySelectorAll(\'[data-slot="action-items-header"] [role="radiogroup"] [role="radio"]\')).map((option) => option.innerText.trim()).join(" | ")';
    $groups = 'Array.from(document.querySelectorAll(\'tr[data-slot="action-group"]\')).map((row) => row.innerText.replace(/\s+/g, " ").trim().split(" In progress")[0]).sort().join(" | ")';

    $page = $this->signIn($alice, workspaceActionItemsPath($platform))->resize(1440, 900);

    $page->click('[data-slot="action-items-header"] a:has-text("All teams")')
        ->assertQueryStringMissing('team')
        ->assertScript($segments, 'Sprint | Team | Assignee | None')
        ->assertAttribute(groupByButton('Sprint'), 'aria-checked', 'true')
        ->assertScript($groups, 'Atlas · Sprint 42 | Platform · Sprint 7')
        ->click(groupByButton('Team'))
        ->assertAttribute(groupByButton('Team'), 'aria-checked', 'true');

    $page->navigate(workspaceActionItemsPath($platform))
        ->click('[data-slot="action-items-header"] a:has-text("All teams")')
        ->assertAttribute(groupByButton('Team'), 'aria-checked', 'true')
        ->assertPresent('tr[data-slot="action-group"]:has-text("Atlas")')
        ->assertNoJavaScriptErrors();
});

it('keeps the palette on "/" on the actions page, and the palette button with its shortcut on the other pages', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    teamActionItem($team, $alice, 'Rotate the keys');

    $page = $this->signIn($alice, workspaceActionItemsPath($team))->resize(1440, 900);

    $page->assertPresent('header input[aria-label="Search action items"]')
        ->assertNotPresent('@command-menu-button')
        ->click('[data-slot="action-items-header"] h1')
        ->keys('[data-slot="action-items-header"] h1', '/')
        ->assertPresent('[data-slot="command-input"]')
        ->keys('[data-slot="command-input"]', 'Escape')
        ->assertNotPresent('[data-slot="command-input"]');

    $page->navigate('/dashboard')
        ->assertNotPresent('input[aria-label="Search action items"]')
        ->assertPresent('@command-menu-button')
        ->keys('@command-menu-button', 'ControlOrMeta+k')
        ->assertPresent('[data-slot="command-input"]')
        ->assertNoJavaScriptErrors();
});

it('reads "99+ overdue" in the sidebar above 99 with the full count for screen readers, a dot when collapsed, and nothing at zero', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $alice = renamedUser(teamMember($team), 'Alice Martin');
    $bob = renamedUser(teamMember($team), 'Bob Stone');
    ActionItem::factory()->withoutRetro($team, $alice)->count(120)->create([
        'assignee_user_id' => $alice->id,
        'due_on' => ActionItem::today()->subDays(2)->toDateString(),
    ]);
    $badge = '[data-sidebar="menu-badge"]';

    $page = $this->signIn($alice, workspaceActionItemsPath($team))->resize(1440, 900);

    $page->assertSeeIn("{$badge} [aria-hidden]", '99+ overdue')
        ->assertSeeIn("{$badge} .sr-only", '120 overdue')
        ->assertPresent('a[data-sidebar="menu-button"][aria-label="Actions, 120 overdue"]')
        ->assertScript('getComputedStyle(document.querySelector(\'[data-slot="overdue-dot"]\')).display', 'none')
        ->click('[data-sidebar="trigger"]')
        ->assertPresent('[data-state="collapsed"]')
        ->assertScript('getComputedStyle(document.querySelector(\'[data-slot="overdue-dot"]\')).display', 'block')
        ->assertNoJavaScriptErrors();

    $this->signIn($bob, workspaceActionItemsPath($team))
        ->assertPresent('a[data-sidebar="menu-button"][aria-label="Actions"]')
        ->assertNotPresent($badge)
        ->assertNotPresent('[data-slot="overdue-dot"]');
});

it('shows "Start to" first in the Jira status mapping and saves the chosen start status', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);
    Http::preventStrayRequests();
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['title' => 'Sprint 12']);
    [$ada, $participant] = retroFacilitator($retro);
    $ada->forceFill(['name' => 'Ada Admin', 'locale' => 'en'])->save();
    $retro->team->workspace->members()->updateExistingPivot($ada->id, ['role' => WorkspaceRole::Admin->value]);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $integration->forceFill([
        'settings' => [...$integration->settings, 'statusSync' => true, 'statusSyncSince' => now()->toIso8601String()],
        'inbound_mode' => IntegrationInboundMode::Polling,
        'last_polled_at' => now(),
        'poll_cursor' => now(),
    ])->save();
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id, 'content' => 'Speed up CI']);
    ActionItemExternalLink::factory()->create([
        'action_item_id' => $item->id,
        'source' => IntegrationProvider::Jira,
        'external_site' => 'cloud-1',
        'external_id' => '10001',
        'external_key' => 'PROJ-1',
        'external_url' => 'https://acme.atlassian.net/browse/PROJ-1',
    ]);
    Http::fake([
        jiraApiUrl('rest/api/3/project/PROJ/statuses') => Http::response([
            ['id' => '1', 'name' => 'Task', 'statuses' => [
                ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']],
                ['id' => '3', 'name' => 'In Progress', 'statusCategory' => ['key' => 'indeterminate']],
                ['id' => '10004', 'name' => 'In Review', 'statusCategory' => ['key' => 'indeterminate']],
                ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']],
            ]],
        ]),
        'api.atlassian.com/*' => Http::response(['message' => 'Unexpected request in a browser test.'], 404),
    ]);
    $selects = 'Array.from(document.querySelectorAll(\'[data-test="integration-panel-jira"] [aria-label$=" to"]\')).map((select) => select.getAttribute("aria-label")).join(" | ")';

    $page = $this->signIn($ada, route('teams.integrations.index', [$retro->team->workspace, $retro->team], false));

    $this->openIntegration($page, 'jira')
        ->click('Edit mapping')
        ->assertVisible('[aria-label="Start to"]')
        ->assertScript($selects, 'Start to | Complete to | Reopen to')
        ->assertSeeIn('[aria-label="Start to"]', 'Automatic')
        ->click('[aria-label="Start to"]')
        ->click('[role="option"]:has-text("In Review")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('[aria-label="Start to"]', 'In Review')
        ->assertSee('Status mapping saved.')
        ->assertNoJavaScriptErrors();

    expect($integration->fresh()->setting('statusMapping.projects.PROJ.startStatusId'))->toBe('10004');
});

it('names a done action item "Fait" in French, on the row badge and in the status facet', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $claire = renamedUser(teamMember($team), 'Claire Dupont', 'fr');
    $done = teamActionItem($team, $claire, 'Déplacer la daily', ['completed_at' => now()]);

    $page = $this->signIn($claire, workspaceActionItemsPath($team, 'status=todo,doing,completed'))->resize(1440, 900);

    $page->assertSeeIn(actionItemRow($done).' [data-slot="action-row-status"]', 'Fait')
        ->click('[data-slot="action-item-filters"] [aria-label="Statut"]')
        ->assertPresent('[role="listbox"] [role="option"]:has-text("Fait")')
        ->assertNoJavaScriptErrors();
});
