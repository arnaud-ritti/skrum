<?php

use App\Actions\Integrations\ApplyIssueChanges;
use App\Enums\ActionItemPriority;
use App\Enums\ActionItemRecurrence;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\ActionItemExternalLink;
use App\Models\ActionItemSubtask;
use App\Models\IntegrationUserMapping;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamIntegration;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\DocsWorld;

function docsActionItemsWeek(): CarbonImmutable
{
    return ActionItem::today()->startOfWeek();
}

/**
 * @param  array<string, string>  $query
 */
function docsActionItemsPath(DocsWorld $world, array $query = []): string
{
    return route('workspaces.actionItems.index', ['workspace' => $world->workspace, 'team' => $world->team->id, ...$query], false);
}

function docsActionItemsRetro(DocsWorld $world): Retro
{
    $heldAt = docsActionItemsWeek()->subDays(10)->setTime(15, 0);

    $retro = Retro::factory()->for($world->team)->inPhase(RetroPhase::Completed)->create([
        'title' => 'Sprint 42 retrospective',
        'created_at' => $heldAt,
        'completed_at' => $heldAt->addHour(),
    ]);

    $facilitator = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $world->person('Théo')->id]);

    $retro->forceFill(['facilitator_participant_id' => $facilitator->id])->save();

    return $retro;
}

/**
 * @param  array<string, mixed>  $attributes
 */
function docsActionItemsDecided(Retro $retro, string $content, array $attributes = []): ActionItem
{
    return ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $retro->facilitator_participant_id,
        'content' => $content,
        'created_at' => $retro->created_at,
        ...$attributes,
    ]);
}

/**
 * @return array{
 *     tests: ActionItem,
 *     runbook: ActionItem,
 *     hotfixes: ActionItem,
 *     handover: ActionItem,
 *     room: ActionItem
 * }
 */
function docsActionItemsStory(DocsWorld $world): array
{
    $retro = docsActionItemsRetro($world);
    $week = docsActionItemsWeek();

    $runbook = docsActionItemsDecided($retro, 'Write the runbook for the database failover', [
        'assignee_user_id' => $world->person('Inès')->id,
        'priority' => ActionItemPriority::High,
        'due_on' => $week->addDays(11)->toDateString(),
        'started_at' => $week->subDays(3)->setTime(10, 0),
    ]);

    foreach (['Rehearse on staging', 'Publish the runbook in the wiki'] as $position => $content) {
        ActionItemSubtask::factory()->create([
            'action_item_id' => $runbook->id,
            'content' => $content,
            'position' => $position,
            'completed_at' => $position === 0 ? $week->subDay() : null,
        ]);
    }

    $handover = teamActionItem($world->team, $world->person('Sofia'), 'Rotate the on-call handover', [
        'assignee_user_id' => $world->person('Sofia')->id,
        'due_on' => $week->addDays(10)->toDateString(),
        'recurrence' => ActionItemRecurrence::Weekly,
    ]);

    foreach (['Update the on-call calendar', 'Hand over the open incidents'] as $position => $content) {
        ActionItemSubtask::factory()->create(['action_item_id' => $handover->id, 'content' => $content, 'position' => $position]);
    }

    return [
        'tests' => docsActionItemsDecided($retro, 'Fix the flaky end-to-end tests of the checkout', [
            'assignee_user_id' => $world->person('Malik')->id,
            'priority' => ActionItemPriority::High,
            'due_on' => $week->subDays(3)->toDateString(),
        ]),
        'runbook' => $runbook,
        'hotfixes' => docsActionItemsDecided($retro, 'Agree on a definition of done for hotfixes', [
            'assignee_user_id' => $world->person('Théo')->id,
            'due_on' => $week->addDays(18)->toDateString(),
        ]),
        'handover' => $handover,
        'room' => teamActionItem($world->team, $world->person('Camille'), 'Book the room for the quarterly planning', [
            'priority' => ActionItemPriority::Low,
        ]),
    ];
}

function docsActionItemsComment(ActionItem $item, User $author, string $content, int $daysBeforeTheWeek): ActionItemComment
{
    return ActionItemComment::factory()->create([
        'action_item_id' => $item->id,
        'author_user_id' => $author->id,
        'content' => $content,
        'created_at' => docsActionItemsWeek()->subDays($daysBeforeTheWeek)->setTime(11, 0),
    ]);
}

function docsActionItemsJira(DocsWorld $world, bool $statusSync = false): TeamIntegration
{
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);

    return TeamIntegration::factory()->jira()->create(['team_id' => $world->team->id])->mergeSettings([
        'siteUrl' => 'https://nordlys.atlassian.net',
        'siteName' => 'Nordlys',
        'statusSync' => $statusSync,
        'statusSyncSince' => $statusSync ? now()->subMonth()->toIso8601String() : null,
    ]);
}

function docsActionItemsJiraIssue(ActionItem $item, int $number): ActionItemExternalLink
{
    return ActionItemExternalLink::factory()->create([
        'action_item_id' => $item->id,
        'external_id' => (string) (10000 + $number),
        'external_key' => "ATLAS-{$number}",
        'external_url' => "https://nordlys.atlassian.net/browse/ATLAS-{$number}",
    ]);
}

function docsActionItemsFakeJira(): void
{
    $priorities = [
        ['id' => '2', 'name' => 'High'],
        ['id' => '3', 'name' => 'Medium'],
        ['id' => '4', 'name' => 'Low'],
    ];

    Http::fake([
        jiraApiUrl('rest/api/3/priority/search*') => Http::response(['values' => $priorities]),
        jiraApiUrl('rest/api/3/project/search*') => Http::response(['values' => [
            ['id' => '10000', 'key' => 'ATLAS', 'name' => 'Atlas platform'],
        ]]),
        jiraApiUrl('rest/api/3/issuetype/project*') => Http::response([
            ['id' => '10', 'name' => 'Bug', 'subtask' => false],
            ['id' => '11', 'name' => 'Task', 'subtask' => false],
        ]),
        jiraApiUrl('rest/api/3/issue/createmeta/*') => Http::response(jiraCreateMeta(priorities: $priorities)),
        jiraApiUrl('rest/api/3/issue') => Http::response(['id' => '10131', 'key' => 'ATLAS-131'], 201),
        'api.atlassian.com/*' => Http::response(['errorMessages' => ['A capture asked Jira for something it does not fake.']], 404),
    ]);
}

it('shows the action items of the Atlas team under their sprints, with the filters above them', function () {
    $world = DocsWorld::create();
    $items = docsActionItemsStory($world);
    docsActionItemsJiraIssue($items['tests'], 128);
    teamActionItem($world->team, $world->person('Noa'), 'Archive the old release notes', ['completed_at' => now()->subDay()]);

    $page = $this->docsVisit($world->person('Camille'), docsActionItemsPath($world))
        ->assertSeeIn('[data-slot="action-items-counts"]', '5 open · 1 overdue · from 1 ritual')
        ->assertSeeIn('[data-slot="action-items-scope"] [aria-current="page"]', 'Atlas')
        ->assertCount('[data-slot="action-item-filters"] [data-slot="action-filter"]', 5)
        ->assertCount('tr[data-slot="action-group"]', 2)
        ->assertCount('tr[data-slot="action-row"]', 5)
        ->assertSeeIn(actionItemRow($items['tests']).' [data-slot="action-row-due"]', 'Overdue')
        ->assertSeeIn(actionItemRow($items['tests']).' [data-slot="action-row-ticket"]', 'ATLAS-128')
        ->assertNotPresent('[data-slot="action-items-page"] .animate-pulse');

    $this->docShot($page, 'action-items/list', '[data-slot="action-items-page"]');
});

it('shows the details of an action item with its sub-tasks and its comments', function () {
    $world = DocsWorld::create();
    $items = docsActionItemsStory($world);
    docsActionItemsComment($items['runbook'], $world->person('Inès'), 'The first draft is in the wiki, comments welcome.', 2);
    docsActionItemsComment($items['runbook'], $world->person('Théo'), 'The rehearsal is booked with the platform team.', 1);
    $sheet = '[data-slot="action-sheet"]';

    $page = $this->docsVisit($world->person('Camille'), docsActionItemsPath($world, ['item' => $items['runbook']->id]))
        ->assertSeeIn("{$sheet} [data-slot=\"sheet-title\"]", 'Write the runbook for the database failover')
        ->assertAttribute($sheet, 'data-status', 'doing')
        ->assertSeeIn("{$sheet} [data-slot=\"action-sheet-subtasks\"]", '1/2')
        ->assertCount("{$sheet} [data-slot=\"item-comment\"]", 2)
        ->assertVisible("{$sheet} [data-slot=\"item-comments\"] button:has-text(\"Comment\")")
        ->assertSeeIn("{$sheet} [data-slot=\"sheet-footer\"]", 'Mark as done')
        ->assertNotPresent("{$sheet} .animate-pulse")
        ->click("{$sheet} [data-slot=\"sheet-description\"]");

    $this->docShot($page, 'action-items/detail', $sheet);
});

it('shows the bar that changes the selected action items at once', function () {
    $world = DocsWorld::create();
    $items = docsActionItemsStory($world);
    docsActionItemsJira($world);
    $bar = '[data-slot="action-items-bulk-bar"]';

    $page = $this->docsVisit($world->person('Camille'), docsActionItemsPath($world))
        ->assertCount('tr[data-slot="action-row"]', 5)
        ->assertNotPresent($bar)
        ->click(selectCheckbox($items['hotfixes']->content))
        ->click(selectCheckbox($items['room']->content))
        ->assertSeeIn($bar, '2 selected')
        ->assertSeeIn($bar, 'Status')
        ->assertSeeIn($bar, 'Assign')
        ->assertSeeIn($bar, 'Due date')
        ->assertSeeIn($bar, 'Priority')
        ->assertSeeIn($bar, 'Sync to Jira')
        ->assertSeeIn($bar, 'Delete');

    $this->docShot($page, 'action-items/bulk-bar', $bar);
});

it('shows the fields of the action item a weekly one leaves behind once it is done', function () {
    $world = DocsWorld::create();
    $items = docsActionItemsStory($world);
    $handover = $items['handover'];
    $week = docsActionItemsWeek();
    $sheet = '[data-slot="action-sheet"]';

    $page = $this->docsVisit($world->person('Camille'), docsActionItemsPath($world, ['item' => $handover->id]))
        ->assertSeeIn("{$sheet} [aria-label=\"Repeat\"]", 'Weekly')
        ->click("{$sheet} [data-slot=\"sheet-footer\"] button:has-text(\"Mark as done\")")
        ->assertAttribute($sheet, 'data-status', 'completed');

    $next = ActionItem::query()->where('previous_occurrence_id', $handover->id)->sole();

    expect($next->due_on?->toDateString())->toBe($week->addDays(17)->toDateString())
        ->and($next->recurrence)->toBe(ActionItemRecurrence::Weekly)
        ->and($next->assignee_user_id)->toBe($world->person('Sofia')->id)
        ->and($next->retro_id)->toBeNull()
        ->and($next->subtasks->pluck('content')->all())->toBe(['Update the on-call calendar', 'Hand over the open incidents'])
        ->and($next->subtasks->whereNotNull('completed_at'))->toHaveCount(0);

    $next->forceFill(['created_at' => $week->subDay()->setTime(9, 0)])->save();

    $page->navigate(docsActionItemsPath($world, ['item' => $next->id]))
        ->assertAttribute($sheet, 'data-status', 'open')
        ->assertSeeIn("{$sheet} [aria-label=\"Repeat\"]", 'Weekly')
        ->assertSeeIn("{$sheet} [data-slot=\"sheet-properties\"]", 'Follows up the item completed on')
        ->assertNotPresent("{$sheet} .animate-pulse");

    $this->docShot($page, 'action-items/recurrence', "{$sheet} [data-slot=\"sheet-properties\"]");
});

it('shows the dialog that exports an action item to Jira, then its ticket in the list', function () {
    $world = DocsWorld::create();
    $items = docsActionItemsStory($world);
    $integration = docsActionItemsJira($world);
    IntegrationUserMapping::factory()->create([
        'team_integration_id' => $integration->id,
        'user_id' => $world->person('Inès')->id,
        'external_account_id' => 'jira-ines',
        'external_display_name' => 'Inès Benali',
    ]);
    docsActionItemsFakeJira();
    $row = actionItemRow($items['runbook']);
    $dialog = '[role="dialog"]:has([data-slot="item-export-preview"])';

    $page = $this->docsVisit($world->person('Camille'), docsActionItemsPath($world))
        ->click("{$row} [aria-label=\"Export to Jira\"]")
        ->assertSeeIn("{$dialog} [data-slot=\"dialog-title\"]", 'Export to Jira')
        ->assertSeeIn("{$dialog} [aria-label=\"Project\"]", 'ATLAS — Atlas platform')
        ->assertSeeIn("{$dialog} [aria-label=\"Issue type\"]", 'Task')
        ->assertSeeIn($dialog, 'Assignee: Inès Benali (Jira)')
        ->assertSeeIn($dialog, 'Priority: High')
        ->assertSeeIn($dialog, 'Manage people')
        ->assertEnabled("{$dialog} button:has-text(\"Export\")");

    $this->docShot($page, 'action-items/export-dialog', $dialog);

    $page->click("{$dialog} button:has-text(\"Export\")")
        ->assertSee('Exported as ATLAS-131.')
        ->assertNotPresent($dialog)
        ->assertSeeIn("{$row} [data-slot=\"action-row-ticket\"]", 'ATLAS-131')
        ->assertNotPresent("{$row} [aria-label=\"Export to Jira\"]");
});

it('shows an action item completed from its Jira issue, with the link and what it last read there', function () {
    $world = DocsWorld::create();
    $items = docsActionItemsStory($world);
    $integration = docsActionItemsJira($world, statusSync: true);
    $link = docsActionItemsJiraIssue($items['tests'], 128);
    docsActionItemsComment($items['tests'], $world->person('Malik'), 'The retries are gone, the suite has been green for a week.', 1);
    $sheet = '[data-slot="action-sheet"]';

    resolve(ApplyIssueChanges::class)->handle(
        $integration,
        [$link->external_id],
        [$link->external_id => statusSyncIssue($link->external_id, $link->external_key, 'done', now()->toIso8601String())],
        complete: true,
    );

    expect($items['tests']->refresh()->completed_via_source)->toBe('jira')
        ->and($items['tests']->completed_at)->not->toBeNull();

    $items['tests']->forceFill(['completed_at' => docsActionItemsWeek()->subDay()->setTime(16, 30)])->save();

    $page = $this->docsVisit($world->person('Camille'), docsActionItemsPath($world, ['status' => 'all', 'item' => $items['tests']->id]))
        ->assertAttribute($sheet, 'data-status', 'completed')
        ->assertSeeIn("{$sheet} [data-slot=\"sheet-properties\"]", 'Completed in Jira')
        ->assertAttribute("{$sheet} [data-slot=\"sheet-header\"] [data-slot=\"action-item-link\"]", 'data-sync-state', 'synced')
        ->assertSeeIn("{$sheet} li > span[aria-hidden]", 'Done in Jira')
        ->assertCount("{$sheet} [data-slot=\"item-comment\"]", 1)
        ->assertSeeIn("{$sheet} [data-slot=\"sheet-footer\"]", 'Reopen')
        ->assertNotPresent("{$sheet} .animate-pulse")
        ->click("{$sheet} [data-slot=\"sheet-description\"]");

    $this->docShot($page, 'action-items/tracker-link', $sheet);
});
