<?php

use App\Enums\ActionItemPriority;
use App\Enums\IntegrationProvider;
use App\Enums\TeamRole;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Support\Facades\Http;

function actionItemsBulkPath(Team $team): string
{
    return route('workspaces.actionItems.index', ['workspace' => $team->workspace], false);
}

function actionItemsBulkBarMenu(mixed $page, string $button, string $option): void
{
    $bar = bulkActionsBar();

    $page->click("{$bar} button:has-text(\"{$button}\")")
        ->assertPresent('[role="menu"]')
        ->click("[role=\"menu\"] [role=\"menuitem\"]:has-text(\"{$option}\")")
        ->assertNotPresent('[role="menu"]');
}

it('selects rows one by one, a group and the whole page, and clears the selection', function () {
    [$team, $alice] = platformTeamWithAlice();
    teamActionItem($team, $alice, 'Rotate the keys', ['assignee_user_id' => $alice->id]);
    teamActionItem($team, $alice, 'Book the room', ['assignee_user_id' => $alice->id]);
    teamActionItem($team, $alice, 'Ship the beta');
    $bar = bulkActionsBar();
    $head = '[data-slot="action-select-all"]';

    $page = $this->signIn($alice, actionItemsBulkPath($team))->resize(1440, 900);

    $page->assertNotPresent($bar)
        ->click(selectCheckbox('Rotate the keys'))
        ->assertAttribute(selectCheckbox('Rotate the keys'), 'aria-checked', 'true')
        ->assertSeeIn($bar, '1 selected')
        ->assertAttribute($head, 'aria-checked', 'mixed')
        ->assertPresent('tr[data-slot="action-row"][data-selected="true"]:has-text("Rotate the keys")')
        ->click(selectCheckbox('Book the room'))
        ->assertSeeIn($bar, '2 selected')
        ->click("{$bar} [aria-label=\"Clear selection\"]")
        ->assertNotPresent($bar)
        ->assertAttribute(selectCheckbox('Rotate the keys'), 'aria-checked', 'false');

    $page->click(groupByButton('Assignee'))
        ->assertPresent('tr[data-slot="action-group"]:has-text("Alice Martin")')
        ->click('[data-slot="action-group-select"][aria-label="Select Alice Martin"]')
        ->assertSeeIn($bar, '2 selected')
        ->assertAttribute(selectCheckbox('Ship the beta'), 'aria-checked', 'false')
        ->click($head)
        ->assertSeeIn($bar, '3 selected')
        ->assertAttribute($head, 'aria-checked', 'true')
        ->assertAttribute($head, 'aria-label', 'Clear selection')
        ->click(groupByButton('None'))
        ->assertNotPresent($bar)
        ->click($head)
        ->assertSeeIn($bar, '3 selected')
        ->keys('[data-slot="action-items-page"]', 'Escape')
        ->assertNotPresent($bar)
        ->assertNoJavaScriptErrors();
});

it('starts, prioritises, assigns and schedules the selected rows in bulk', function () {
    [$team, $alice, $bob] = platformTeamWithAlice();
    $keys = teamActionItem($team, $alice, 'Rotate the keys');
    $room = teamActionItem($team, $alice, 'Book the room');
    $today = ActionItem::today()->toDateString();
    $bar = bulkActionsBar();

    $page = $this->signIn($alice, actionItemsBulkPath($team))->resize(1440, 900);

    $page->click(selectCheckbox('Rotate the keys'))
        ->click(selectCheckbox('Book the room'))
        ->assertSeeIn($bar, '2 selected');
    actionItemsBulkBarMenu($page, 'Status', 'In progress');
    $page->assertSee('2 action items updated.')
        ->assertNotPresent($bar)
        ->assertAttribute(actionItemRow($keys), 'data-status', 'doing')
        ->assertAttribute(actionItemRow($room), 'data-status', 'doing')
        ->assertSeeIn(actionItemRow($keys).' [data-slot="action-row-status"]', 'In progress')
        ->assertAttribute(actionItemRow($keys).' [data-slot="action-row-status"]', 'aria-label', 'Mark as done');

    $page->click(selectCheckbox('Rotate the keys'))
        ->click(selectCheckbox('Book the room'));
    actionItemsBulkBarMenu($page, 'Priority', 'High');
    $page->assertSeeIn(actionItemRow($keys), 'High')
        ->assertSeeIn(actionItemRow($room), 'High');

    $page->click(selectCheckbox('Rotate the keys'))
        ->click(selectCheckbox('Book the room'))
        ->click("{$bar} button:has-text(\"Assign\")")
        ->assertPresent('[role="dialog"] [role="option"]:has-text("Unassigned")')
        ->click('[role="option"]:has-text("Bob Stone")')
        ->assertSeeIn(actionItemRow($keys).' [data-slot="action-row-owner"]', 'Bob Stone')
        ->assertSeeIn(actionItemRow($room).' [data-slot="action-row-owner"]', 'Bob Stone');

    $page->click(selectCheckbox('Rotate the keys'))
        ->click(selectCheckbox('Book the room'))
        ->click("{$bar} button:has-text(\"Due date\")")
        ->click("[data-slot=\"calendar-day\"][data-day=\"{$today}\"]")
        ->assertAttribute(actionItemRow($keys).' [data-slot="action-row-due"]', 'data-due', 'soon')
        ->assertAttribute(actionItemRow($room).' [data-slot="action-row-due"]', 'data-due', 'soon')
        ->assertNoJavaScriptErrors();

    foreach ([$keys->fresh(), $room->fresh()] as $item) {
        expect($item->started_at)->not->toBeNull()
            ->and($item->completed_at)->toBeNull()
            ->and($item->priority)->toBe(ActionItemPriority::High)
            ->and($item->assignee_user_id)->toBe($bob->id)
            ->and($item->due_on?->toDateString())->toBe($today);
    }
});

it('reports the rows a bulk change refused, keeps them selected and locks the rows the member cannot change', function () {
    [$team, $alice, $bob] = platformTeamWithAlice();
    $mine = teamActionItem($team, $alice, 'Rotate the keys');
    $assigned = teamActionItem($team, $bob, 'Fix the flaky test', ['assignee_user_id' => $alice->id]);
    teamActionItem($team, $bob, 'Book the room');
    $bar = bulkActionsBar();
    $details = '[role="dialog"]:has([data-slot="bulk-refusals"])';

    $page = $this->signIn($alice, actionItemsBulkPath($team))->resize(1440, 900);

    $page->assertPresent('[data-slot="action-row-select-locked"][aria-label="Select Book the room"]')
        ->assertDisabled(selectCheckbox('Book the room'))
        ->click(selectCheckbox('Rotate the keys'))
        ->click(selectCheckbox('Fix the flaky test'));
    actionItemsBulkBarMenu($page, 'Priority', 'Low');
    $page->assertSee('1 updated, 1 not changed.')
        ->assertSeeIn($bar, '1 selected')
        ->assertAttribute(selectCheckbox('Fix the flaky test'), 'aria-checked', 'true')
        ->assertAttribute(selectCheckbox('Rotate the keys'), 'aria-checked', 'false')
        ->click('[data-sonner-toast] button:has-text("Details")')
        ->assertSeeIn($details, 'Action items not changed')
        ->assertSeeIn("{$details} [data-slot=\"bulk-refusals\"]", 'Fix the flaky test')
        ->assertSeeIn("{$details} [data-slot=\"bulk-refusals\"]", 'Only the author, the facilitator or an admin can change this action item.')
        ->assertDontSeeIn("{$details} [data-slot=\"bulk-refusals\"]", 'Rotate the keys')
        ->click("{$details} [data-slot=\"dialog-close\"]")
        ->assertNotPresent($details)
        ->assertNoJavaScriptErrors();

    expect($mine->fresh()->priority)->toBe(ActionItemPriority::Low)
        ->and($assigned->fresh()->priority)->toBe(ActionItemPriority::Medium);
});

it('deletes the selected rows only after the confirmation', function () {
    [$team, $alice] = platformTeamWithAlice();
    $keys = teamActionItem($team, $alice, 'Rotate the keys');
    $room = teamActionItem($team, $alice, 'Book the room');
    $kept = teamActionItem($team, $alice, 'Ship the beta');
    $bar = bulkActionsBar();
    $confirm = '[role="alertdialog"]';

    $page = $this->signIn($alice, actionItemsBulkPath($team))->resize(1440, 900);

    $page->click(selectCheckbox('Rotate the keys'))
        ->click(selectCheckbox('Book the room'))
        ->click("{$bar} button:has-text(\"Delete\")")
        ->assertSeeIn($confirm, 'Delete 2 action items?')
        ->assertSeeIn($confirm, 'This cannot be undone. Their comments and sub-tasks are deleted too.')
        ->click("{$confirm} button:has-text(\"Cancel\")")
        ->assertNotPresent($confirm)
        ->assertSeeIn($bar, '2 selected')
        ->click("{$bar} button:has-text(\"Delete\")")
        ->click("{$confirm} button:has-text(\"Delete\")")
        ->assertSee('2 action items deleted.')
        ->assertNotPresent(actionItemRow($keys))
        ->assertNotPresent(actionItemRow($room))
        ->assertPresent(actionItemRow($kept))
        ->assertNotPresent($bar)
        ->assertNoJavaScriptErrors();

    expect(ActionItem::query()->pluck('id')->all())->toBe([$kept->id]);
});

it('completes every matching item after the confirmation, asks again when the list changed meanwhile, and keeps the sync to page rows', function () {
    [$team, $alice] = platformTeamWithAlice();
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    ActionItem::factory()->withoutRetro($team, $alice)->count(51)->create();
    $first = ActionItem::query()->orderBy('sort_rank')->orderBy('id')->first();
    $bar = bulkActionsBar();
    $head = '[data-slot="action-select-all"]';
    $offer = "{$bar} [data-slot=\"bulk-select-matching\"]";
    $confirm = '[role="alertdialog"]';
    $sync = "{$bar} button:has-text(\"Sync to Jira\")";

    $page = $this->signIn($alice, actionItemsBulkPath($team))->resize(1440, 900);

    $page->assertCount('tr[data-slot="action-row"]', 50)
        ->click($head)
        ->assertSeeIn($bar, '50 selected')
        ->assertEnabled($sync)
        ->assertSeeIn($offer, 'Select all 51 matching')
        ->click($offer)
        ->assertSeeIn($bar, 'All 51 matching selected')
        ->assertDisabled($sync)
        ->assertNotPresent($offer)
        ->click(selectCheckbox($first->content))
        ->assertSeeIn($bar, '49 selected')
        ->click(selectCheckbox($first->content))
        ->click($offer)
        ->assertSeeIn($bar, 'All 51 matching selected');

    teamActionItem($team, $alice, 'Added meanwhile');

    actionItemsBulkBarMenu($page, 'Status', 'Done');
    $page->assertSeeIn($confirm, 'Apply to 51 action items?')
        ->assertSeeIn($confirm, 'Every action item matching the filters is changed: 51 in all.')
        ->click("{$confirm} button:has-text(\"Apply\")")
        ->assertSeeIn($confirm, 'The list changed: 52 action items match now.');

    expect(ActionItem::query()->whereNotNull('completed_at')->count())->toBe(0);

    $page->assertSeeIn($confirm, 'Apply to 52 action items?')
        ->click("{$confirm} button:has-text(\"Apply\")")
        ->assertSee('52 action items updated.')
        ->assertNotPresent($confirm)
        ->assertNotPresent($bar)
        ->assertSee('No open action items.')
        ->assertNoJavaScriptErrors();

    expect(ActionItem::query()->whereNull('completed_at')->count())->toBe(0);
});

it('shows the bulk changes and deletions of one member to another member live', function () {
    [$team, $alice, $bob] = platformTeamWithAlice();
    $keys = teamActionItem($team, $alice, 'Rotate the keys');
    $room = teamActionItem($team, $alice, 'Book the room');
    $beta = teamActionItem($team, $alice, 'Ship the beta');
    $path = actionItemsBulkPath($team);
    $bar = bulkActionsBar();

    $alicePage = $this->awaitRealtime($this->signIn($alice, $path))->resize(1440, 900);
    $bobPage = $this->awaitRealtime($this->signIn($bob, $path))->resize(1440, 900);

    $bobPage->assertAttribute(actionItemRow($keys), 'data-status', 'open');

    $alicePage->click(selectCheckbox('Rotate the keys'))
        ->click(selectCheckbox('Book the room'));
    actionItemsBulkBarMenu($alicePage, 'Status', 'In progress');
    $alicePage->assertSee('2 action items updated.');

    $bobPage->assertAttribute(actionItemRow($keys), 'data-status', 'doing')
        ->assertAttribute(actionItemRow($room), 'data-status', 'doing')
        ->assertAttribute(actionItemRow($beta), 'data-status', 'open');

    $alicePage->click(selectCheckbox('Book the room'))
        ->click(selectCheckbox('Ship the beta'))
        ->click("{$bar} button:has-text(\"Delete\")")
        ->click('[role="alertdialog"] button:has-text("Delete")')
        ->assertSee('2 action items deleted.');

    $bobPage->assertNotPresent(actionItemRow($room))
        ->assertNotPresent(actionItemRow($beta))
        ->assertPresent(actionItemRow($keys))
        ->assertNoJavaScriptErrors();
});

it('syncs the unlinked rows of a one-team selection to Jira one by one and skips the linked one', function () {
    [$team, $alice] = platformTeamWithAlice();
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $keys = teamActionItem($team, $alice, 'Rotate the keys');
    $room = teamActionItem($team, $alice, 'Book the room');
    $linked = teamActionItem($team, $alice, 'Ship the beta');
    ActionItemExternalLink::factory()->create(['action_item_id' => $linked->id, 'external_key' => 'PROJ-7']);
    $issues = 0;
    Http::fake([
        jiraApiUrl('rest/api/3/priority/search*') => Http::response(['values' => [['id' => '3', 'name' => 'Medium']]]),
        jiraApiUrl('rest/api/3/project/search*') => Http::response(['values' => [['id' => '10000', 'key' => 'PROJ', 'name' => 'Project']]]),
        jiraApiUrl('rest/api/3/issuetype/project*') => Http::response([['id' => '11', 'name' => 'Task', 'subtask' => false]]),
        jiraApiUrl('rest/api/3/issue/createmeta/*') => Http::response(jiraCreateMeta(priorities: [['id' => '3', 'name' => 'Medium']])),
        jiraApiUrl('rest/api/3/issue') => function () use (&$issues) {
            $issues++;
            $id = 10040 + $issues;

            return Http::response(['id' => (string) $id, 'key' => "PROJ-{$id}", 'self' => "https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/{$id}"], 201);
        },
        'api.atlassian.com/*' => Http::response(['errorMessages' => ['Unexpected request in a browser test.']], 404),
    ]);
    $bar = bulkActionsBar();
    $dialog = '[data-slot="bulk-sync-dialog"]';

    $page = $this->signIn($alice, actionItemsBulkPath($team))->resize(1440, 900);

    $page->click(selectCheckbox('Rotate the keys'))
        ->click(selectCheckbox('Book the room'))
        ->click(selectCheckbox('Ship the beta'))
        ->assertSeeIn($bar, '3 selected')
        ->click("{$bar} button:has-text(\"Sync to Jira\")")
        ->assertSeeIn($dialog, 'Sync to Jira')
        ->assertSeeIn("{$dialog} [aria-label=\"Issue type\"]", 'Task')
        ->assertSeeIn($dialog, 'Export 2 items')
        ->click("{$dialog} button:has-text(\"Export 2 items\")")
        ->assertSee('2 exported, 1 already linked.')
        ->assertNotPresent($dialog)
        ->assertNotPresent($bar)
        ->assertPresent(actionItemRow($keys).' [data-slot="action-row-ticket"] a[href^="https://acme.atlassian.net/browse/PROJ-"]')
        ->assertPresent(actionItemRow($room).' [data-slot="action-row-ticket"] a[href^="https://acme.atlassian.net/browse/PROJ-"]')
        ->assertNoJavaScriptErrors();

    expect(ActionItemExternalLink::query()->where('action_item_id', $keys->id)->exists())->toBeTrue()
        ->and(ActionItemExternalLink::query()->where('action_item_id', $room->id)->exists())->toBeTrue()
        ->and(ActionItemExternalLink::query()->where('action_item_id', $linked->id)->count())->toBe(1)
        ->and($issues)->toBe(2);
});

it('keeps the rows of a team the member only observes out of the selection and the status cycle', function () {
    [$team, $alice, $bob] = platformTeamWithAlice();
    $team->members()->updateExistingPivot($alice->id, ['role' => TeamRole::Observer->value]);
    $authored = teamActionItem($team, $alice, 'Rotate the keys');
    $assigned = teamActionItem($team, $bob, 'Book the room', ['assignee_user_id' => $alice->id]);

    $page = $this->signIn($alice, actionItemsBulkPath($team))->resize(1440, 900);

    $page->assertCount('[data-slot="action-row-select-locked"]', 2)
        ->assertDisabled(selectCheckbox('Rotate the keys'))
        ->assertDisabled(selectCheckbox('Book the room'))
        ->assertDisabled('[data-slot="action-select-all"]')
        ->assertDisabled(actionItemRow($authored).' [data-slot="action-row-status"]')
        ->assertDisabled(actionItemRow($assigned).' [data-slot="action-row-status"]')
        ->assertNotPresent(actionItemRow($authored).' [aria-label="More actions"]')
        ->assertNoJavaScriptErrors();
});
