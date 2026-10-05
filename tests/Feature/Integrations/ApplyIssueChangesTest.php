<?php

use App\Actions\Integrations\ApplyIssueChanges;
use App\Actions\Integrations\LinkStatusSync;
use App\Actions\Integrations\RefreshPokerTasks;
use App\Enums\ActionItemEventOrigin;
use App\Enums\ActionItemRecurrence;
use App\Enums\ActionItemStatus;
use App\Enums\ExternalIssueState;
use App\Enums\ExternalStatusCategory;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemProgressChanged;
use App\Events\ActionItems\ActionItemReopened;
use App\Events\Poker\PokerGameChanged;
use App\Events\Poker\PokerTaskSaved;
use App\Events\Retros\ActionItemExternalLinksChanged;
use App\Jobs\Integrations\PushActionItemState;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\PokerTask;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\DoneMapping;
use App\Support\Integrations\Trackers\TrackerIssue;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
});

/**
 * @param  array<int, TrackerIssue>  $issues
 * @param  array<int, string>  $ids
 */
function applyStatusSyncIssues(TeamIntegration $integration, array $issues, array $ids = ['10001'], bool $complete = true, bool $sourceWins = false): void
{
    $keyed = [];

    foreach ($issues as $issue) {
        $keyed[$issue->externalId] = $issue;
    }

    resolve(ApplyIssueChanges::class)->handle($integration, $ids, $keyed, $complete, $sourceWins);
}

function syncedPokerTable(): array
{
    $table = trackerTable();
    $table['integration']->forceFill(['settings' => [...$table['integration']->settings, 'statusSync' => true]])->save();

    return $table;
}

it('completes the item as the system when the source is done', function () {
    Event::fake([ActionItemCompleted::class]);
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink();

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'done', '2026-10-07T10:20:00+00:00')]);

    $item->refresh();
    $link->refresh();
    expect($item->completed_at)->not->toBeNull()
        ->and($item->completed_via_source)->toBe('jira')
        ->and($link->external_state)->toBe(ExternalIssueState::Done)
        ->and($link->external_status_name)->toBe('Done')
        ->and($link->external_updated_at?->toIso8601String())->toBe('2026-10-07T10:20:00+00:00')
        ->and($link->last_synced_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00');
    Event::assertDispatched(fn (ActionItemCompleted $event) => $event->origin === ActionItemEventOrigin::External);
    Queue::assertNotPushed(PushActionItemState::class);
});

it('completes an item on a locked board as the system and keeps recurrences', function () {
    ['integration' => $integration, 'item' => $item, 'retro' => $retro] = statusSyncLink(item: [
        'recurrence' => ActionItemRecurrence::Weekly,
        'due_on' => '2026-10-10',
    ]);
    $retro->forceFill(['phase' => RetroPhase::Discussing, 'is_locked' => true])->save();

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'done')]);

    expect($item->fresh()->completed_at)->not->toBeNull()
        ->and(ActionItem::query()->where('previous_occurrence_id', $item->id)->count())->toBe(1);
});

it('reopens the item when the source reopens', function () {
    Event::fake([ActionItemReopened::class]);
    ['integration' => $integration, 'item' => $item] = statusSyncLink(item: ['completed_at' => '2026-10-06 09:00:00']);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new')]);

    expect($item->fresh()->completed_at)->toBeNull()
        ->and($item->fresh()->completed_via_source)->toBeNull();
    Event::assertDispatched(fn (ActionItemReopened $event) => $event->origin === ActionItemEventOrigin::External);
});

it('only records the read when both sides agree', function () {
    Event::fake([ActionItemCompleted::class, ActionItemReopened::class]);
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink();

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new')]);

    expect($item->fresh()->completed_at)->toBeNull()
        ->and($link->fresh()->external_state)->toBe(ExternalIssueState::Open)
        ->and($link->fresh()->external_status_name)->toBe('To Do');
    Event::assertNotDispatched(ActionItemCompleted::class);
    Event::assertNotDispatched(ActionItemReopened::class);
});

it('keeps a newer unpushed skrum change and pushes it', function () {
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:25:00'],
        item: ['completed_at' => '2026-10-07 10:25:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->completed_at)->not->toBeNull()
        ->and($link->fresh()->external_state)->toBe(ExternalIssueState::Open);
    Queue::assertPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $link->id);
});

it('lets a newer source change win', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:15:00'],
        item: ['completed_at' => '2026-10-07 10:15:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->completed_at)->toBeNull();
    Queue::assertNotPushed(PushActionItemState::class);
});

it('gives a tie to skrum', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:20:00'],
        item: ['completed_at' => '2026-10-07 10:20:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->completed_at)->not->toBeNull();
    Queue::assertPushed(PushActionItemState::class);
});

it('applies the source when the local change was already pushed', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:15:00', 'last_pushed_at' => '2026-10-07 10:16:00', 'last_pushed_state' => ExternalIssueState::Done],
        item: ['completed_at' => '2026-10-07 10:15:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:17:00+00:00')]);

    expect($item->fresh()->completed_at)->toBeNull();
});

it('lets the source win on the first read', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:25:00'],
        item: ['completed_at' => '2026-10-07 10:25:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')], sourceWins: true);

    expect($item->fresh()->completed_at)->toBeNull();
    Queue::assertNotPushed(PushActionItemState::class);
});

it('marks missing issues only when every id was read, and clears the flag when they return', function () {
    ['integration' => $integration, 'link' => $link] = statusSyncLink();

    applyStatusSyncIssues($integration, [], complete: false);
    expect($link->fresh()->missing_at)->toBeNull();

    applyStatusSyncIssues($integration, []);
    expect($link->fresh()->missing_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00');

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new')]);
    expect($link->fresh()->missing_at)->toBeNull();
});

it('ignores links of other teams, other sites and items completed long ago', function () {
    ['integration' => $integration] = statusSyncLink();
    ['link' => $otherTeam] = statusSyncLink();
    $otherSite = ActionItemExternalLink::factory()->create([
        'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id])->id,
        'external_site' => 'cloud-2',
        'external_id' => '10001',
    ]);
    $old = ActionItemExternalLink::factory()->create([
        'action_item_id' => ActionItem::factory()->create(['team_id' => $integration->team_id, 'completed_at' => now()->subDays(100)])->id,
        'external_id' => '10001',
    ]);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'done')]);

    expect($otherTeam->fresh()->last_synced_at)->toBeNull()
        ->and($otherSite->fresh()->last_synced_at)->toBeNull()
        ->and($old->fresh()->last_synced_at)->toBeNull();
});

it('ignores a read older than what the link already knows', function () {
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink([
        'external_state' => ExternalIssueState::Done,
        'external_status_name' => 'Done',
        'external_updated_at' => '2026-10-07 10:22:00',
        'local_state_changed_at' => '2026-10-07 10:21:00',
        'last_pushed_at' => '2026-10-07 10:22:00',
        'last_pushed_state' => ExternalIssueState::Done,
    ], item: ['completed_at' => '2026-10-07 10:21:00']);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->completed_at)->not->toBeNull()
        ->and($link->fresh()->external_state)->toBe(ExternalIssueState::Done)
        ->and($link->fresh()->external_updated_at?->toIso8601String())->toBe('2026-10-07T10:22:00+00:00');
    Queue::assertNotPushed(PushActionItemState::class);
});

it('ignores a read older than the last push when the link has no source time yet', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink([
        'local_state_changed_at' => '2026-10-07 10:21:00',
        'last_pushed_at' => '2026-10-07 10:22:00',
        'last_pushed_state' => ExternalIssueState::Done,
    ], item: ['completed_at' => '2026-10-07 10:21:00']);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->completed_at)->not->toBeNull();
});

it('keeps a newer skrum change on the first read when the link was pushed before', function () {
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink([
        'local_state_changed_at' => '2026-10-07 10:25:00',
        'last_pushed_at' => '2026-10-07 09:00:00',
        'last_pushed_state' => ExternalIssueState::Open,
    ], item: ['completed_at' => '2026-10-07 10:25:00']);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')], sourceWins: true);

    expect($item->fresh()->completed_at)->not->toBeNull();
    Queue::assertPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $link->id);
});

it('treats an issue without a readable status as found and leaves its state alone', function () {
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink([
        'external_state' => ExternalIssueState::Open,
        'external_status_name' => 'To Do',
        'missing_at' => '2026-10-06 10:00:00',
    ]);
    $issue = statusSyncIssue('10001', 'PROJ-1', 'done');
    $issue->issueStatus = null;

    applyStatusSyncIssues($integration, [$issue]);

    expect($link->fresh()->missing_at)->toBeNull()
        ->and($link->fresh()->external_state)->toBe(ExternalIssueState::Open)
        ->and($link->fresh()->external_status_name)->toBe('To Do')
        ->and($item->fresh()->completed_at)->toBeNull();
});

it('keeps an unpushed skrum change when the source time is unknown', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:25:00'],
        item: ['completed_at' => '2026-10-07 10:25:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', null)]);

    expect($item->fresh()->completed_at)->not->toBeNull();
    Queue::assertPushed(PushActionItemState::class);
});

it('announces link changes only when a link or the item changed', function () {
    Event::fake([ActionItemExternalLinksChanged::class]);
    ['integration' => $integration, 'retro' => $retro] = statusSyncLink([
        'external_state' => ExternalIssueState::Open,
        'external_status_name' => 'To Do',
    ]);
    $retro->forceFill(['phase' => RetroPhase::Discussing])->save();

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new')]);
    Event::assertNotDispatched(ActionItemExternalLinksChanged::class);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'indeterminate', overrides: ['status' => 'In Review'])]);
    Event::assertDispatchedTimes(ActionItemExternalLinksChanged::class, 1);
});

it('does not queue pushes again and again on a read-only connection', function () {
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:25:00', 'sync_error' => 'This Jira connection is read-only.'],
        IntegrationAccess::Read,
        ['completed_at' => '2026-10-07 10:25:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);
    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->completed_at)->not->toBeNull()
        ->and($link->fresh()->sync_error)->toBe('This Jira connection is read-only.');
    Queue::assertNotPushed(PushActionItemState::class);
});

it('keeps a reopening made while the push ran when the push echoes back', function () {
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:30:00'],
        item: ['completed_at' => '2026-10-07 10:30:00'],
    );
    $open = ['status' => ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']], 'project' => ['key' => 'PROJ'], 'updated' => '2026-10-07T10:00:00.000+0000'];
    $done = ['status' => ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']], 'project' => ['key' => 'PROJ'], 'updated' => '2026-10-07T10:30:04.000+0000'];
    Http::fake([
        jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [jiraTrackerIssue('10001', 'PROJ-1', $open)], 'isLast' => true]),
        jiraApiUrl('rest/api/3/issue/10001?*') => Http::response(jiraTrackerIssue('10001', 'PROJ-1', $done)),
        jiraApiUrl('rest/api/3/issue/10001/transitions*') => function (HttpRequest $request) use ($item, $link) {
            if ($request->method() !== 'POST') {
                return Http::response(['transitions' => [jiraTransition('31', '10002', 'Done', 'done')]]);
            }

            $this->travel(3)->seconds();
            $item->forceFill(['completed_at' => null])->save();
            ActionItemExternalLink::query()->whereKey($link->id)->update(['local_state_changed_at' => now()]);
            $this->travel(2)->seconds();

            return Http::response(null, 204);
        },
    ]);

    runStatusPush($link);
    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'done', '2026-10-07T10:30:04+00:00')]);

    expect($item->fresh()->completed_at)->toBeNull();
    Queue::assertPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $link->id);
});

it('clears a failed push once both sides agree', function () {
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink([
        'external_state' => ExternalIssueState::Open,
        'local_state_changed_at' => '2026-10-07 10:20:00',
        'sync_error' => 'Jira requires more fields to close PROJ-1. Close it in Jira.',
    ], item: ['completed_at' => '2026-10-07 10:20:00']);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'done', '2026-10-07T10:25:00+00:00')]);

    $link->refresh();
    expect($link->sync_error)->toBeNull()
        ->and(LinkStatusSync::state($link, $item->fresh()))->toBe(LinkStatusSync::Synced);
    Queue::assertNotPushed(PushActionItemState::class);
});

it('pushes a source change to the other synced tracker of the item', function () {
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
    ['integration' => $jira, 'item' => $item, 'link' => $jiraLink] = statusSyncLink();
    $linear = TeamIntegration::factory()->linear()->create(['team_id' => $jira->team_id]);
    $linear->forceFill(['settings' => [...$linear->settings, 'statusSync' => true]])->save();
    $linearLink = ActionItemExternalLink::factory()->create([
        'action_item_id' => $item->id,
        'source' => IntegrationProvider::Linear,
        'external_site' => 'org-1',
        'external_id' => 'lin-1',
        'external_key' => 'ENG-1',
        'external_url' => 'https://linear.app/acme/issue/ENG-1',
    ]);

    applyStatusSyncIssues($jira, [statusSyncIssue('10001', 'PROJ-1', 'done', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->completed_at)->not->toBeNull()
        ->and($linearLink->fresh()->local_state_changed_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00')
        ->and($jiraLink->fresh()->local_state_changed_at)->toBeNull();
    Queue::assertPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $linearLink->id);
    Queue::assertNotPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $jiraLink->id);
});

it('trusts the source time again once the last push is no longer recent', function () {
    ['integration' => $integration, 'item' => $item] = statusSyncLink([
        'local_state_changed_at' => '2026-10-07 10:14:00',
        'last_pushed_at' => '2026-10-07 10:15:00',
        'last_pushed_state' => ExternalIssueState::Done,
    ], item: ['completed_at' => '2026-10-07 10:14:00']);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:12:00+00:00')]);

    expect($item->fresh()->completed_at)->toBeNull();
});

it('refreshes imported tasks of running games with their status', function () {
    Event::fake([PokerTaskSaved::class, PokerGameChanged::class]);
    $table = syncedPokerTable();
    $task = importedPokerTask($table['game']);

    applyStatusSyncIssues($table['integration'], [statusSyncIssue($task->external_id, $task->external_key, 'indeterminate', '2026-10-07T10:05:00+00:00', [
        'status' => 'In Review',
        'title' => 'Renamed in Jira',
        'estimate' => '8',
        'url' => $task->external_url,
    ])], [$task->external_id]);

    $task->refresh();
    expect($task->title)->toBe('Renamed in Jira')
        ->and($task->external_estimate)->toBe('8')
        ->and($task->external_status_name)->toBe('In Review')
        ->and($task->external_status_category)->toBe(ExternalStatusCategory::InProgress)
        ->and($task->external_updated_at?->toIso8601String())->toBe('2026-10-07T10:05:00+00:00')
        ->and($task->external_missing_at)->toBeNull();
    Event::assertDispatchedTimes(PokerTaskSaved::class, 1);
    Event::assertNotDispatched(PokerGameChanged::class);
});

it('leaves ended games alone', function () {
    $table = syncedPokerTable();
    $task = importedPokerTask($table['game']);
    $table['game']->forceFill(['ended_at' => now()->subHour()])->save();

    applyStatusSyncIssues($table['integration'], [statusSyncIssue($task->external_id, $task->external_key, 'done', overrides: ['title' => 'Changed'])], [$task->external_id]);

    expect($task->fresh()->title)->not->toBe('Changed')
        ->and($task->fresh()->external_status_category)->toBeNull();
});

it('announces more than ten changed tasks as one game change', function () {
    Event::fake([PokerTaskSaved::class, PokerGameChanged::class]);
    $table = syncedPokerTable();
    $tasks = collect(range(1, 11))->map(fn () => importedPokerTask($table['game']));

    applyStatusSyncIssues(
        $table['integration'],
        $tasks->map(fn (PokerTask $task) => statusSyncIssue($task->external_id, $task->external_key, 'done'))->all(),
        $tasks->pluck('external_id')->all(),
    );

    Event::assertDispatchedTimes(PokerGameChanged::class, 1);
    Event::assertNotDispatched(PokerTaskSaved::class);
});

it('persists "Not found" when a manual refresh misses an issue', function () {
    $table = trackerTable();
    $task = importedPokerTask($table['game']);
    fakeJiraTrackerApi([]);

    $result = resolve(RefreshPokerTasks::class)->handle($table['game'], $table['facilitatorPlayer']);

    expect($result)->toBe(['refreshed' => 0, 'missing' => 1])
        ->and($task->fresh()->external_missing_at)->not->toBeNull();
});

it('starts an open item when its issue is in progress, as the system and without a push', function () {
    Event::fake([ActionItemCompleted::class, ActionItemReopened::class, ActionItemProgressChanged::class]);
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink();

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'indeterminate', overrides: ['status' => 'In Review'])]);

    $item->refresh();
    $link->refresh();
    expect($item->currentStatus())->toBe(ActionItemStatus::Doing)
        ->and($item->completed_at)->toBeNull()
        ->and($link->external_state)->toBe(ExternalIssueState::Started)
        ->and($link->external_status_name)->toBe('In Review')
        ->and(LinkStatusSync::state($link, $item))->toBe(LinkStatusSync::Synced);
    Event::assertDispatched(fn (ActionItemProgressChanged $event) => $event->origin === ActionItemEventOrigin::External);
    Event::assertNotDispatched(ActionItemCompleted::class);
    Event::assertNotDispatched(ActionItemReopened::class);
    Queue::assertNotPushed(PushActionItemState::class);
});

it('starts an item on a locked board as the system', function () {
    ['integration' => $integration, 'item' => $item, 'retro' => $retro] = statusSyncLink();
    $retro->forceFill(['phase' => RetroPhase::Discussing, 'is_locked' => true])->save();

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'indeterminate')]);

    expect($item->fresh()->started_at)->not->toBeNull();
});

it('puts a started item back to do when its issue went back to do after the start', function () {
    Event::fake([ActionItemProgressChanged::class]);
    ['integration' => $integration, 'item' => $item] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:15:00'],
        item: ['started_at' => '2026-10-07 10:15:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->currentStatus())->toBe(ActionItemStatus::Open);
    Event::assertDispatched(fn (ActionItemProgressChanged $event) => $event->origin === ActionItemEventOrigin::External);
    Queue::assertNotPushed(PushActionItemState::class);
});

it('keeps a newer unpushed start and pushes it', function () {
    ['integration' => $integration, 'item' => $item, 'link' => $link] = statusSyncLink(
        ['local_state_changed_at' => '2026-10-07 10:25:00'],
        item: ['started_at' => '2026-10-07 10:25:00'],
    );

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'new', '2026-10-07T10:20:00+00:00')]);

    expect($item->fresh()->currentStatus())->toBe(ActionItemStatus::Doing)
        ->and($link->fresh()->external_state)->toBe(ExternalIssueState::Open);
    Queue::assertPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $link->id);
});

it('reopens a completed item into in progress when the source reopens it into an in-progress status', function () {
    Event::fake([ActionItemReopened::class]);
    ['integration' => $integration, 'item' => $item] = statusSyncLink(item: ['completed_at' => '2026-10-06 09:00:00']);

    applyStatusSyncIssues($integration, [statusSyncIssue('10001', 'PROJ-1', 'indeterminate', overrides: ['status' => 'In Review'])]);

    $item->refresh();
    expect($item->completed_at)->toBeNull()
        ->and($item->currentStatus())->toBe(ActionItemStatus::Doing);
    Event::assertDispatched(fn (ActionItemReopened $event) => $event->origin === ActionItemEventOrigin::External);
});

it('reads a started item as open for GitHub and as started for Jira and Linear', function (IntegrationProvider $provider, ExternalIssueState $expected) {
    $team = Team::factory()->create();
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->started()->create();

    expect(DoneMapping::itemState($item, $provider))->toBe($expected)
        ->and(DoneMapping::itemState($item->forceFill(['started_at' => null]), $provider))->toBe(ExternalIssueState::Open)
        ->and(DoneMapping::itemState($item->forceFill(['completed_at' => now()]), $provider))->toBe(ExternalIssueState::Done);
})->with([
    'jira' => [IntegrationProvider::Jira, ExternalIssueState::Started],
    'jira data center' => [IntegrationProvider::JiraDataCenter, ExternalIssueState::Started],
    'linear' => [IntegrationProvider::Linear, ExternalIssueState::Started],
    'github' => [IntegrationProvider::GitHub, ExternalIssueState::Open],
]);
