<?php

use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Enums\ActionItemStatus;
use App\Enums\ExternalIssueState;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Jobs\Integrations\PushActionItemState;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Participant;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
    $this->open = ['status' => ['id' => '10000', 'name' => 'To Do', 'statusCategory' => ['key' => 'new']], 'project' => ['key' => 'PROJ']];
    $this->done = ['status' => ['id' => '10002', 'name' => 'Done', 'statusCategory' => ['key' => 'done']], 'project' => ['key' => 'PROJ']];
});

it('queues a push when a manager completes a synced item', function () {
    Queue::fake();
    ['item' => $item, 'retro' => $retro, 'author' => $author, 'link' => $link] = statusSyncLink();

    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItems.update', [$retro->team->workspace, $item]), ['status' => 'completed'])
        ->assertOk();

    Queue::assertPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $link->id);
    expect($link->fresh()->local_state_changed_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00');
});

it('records the change but pushes nothing while sync is off', function () {
    Queue::fake();
    ['item' => $item, 'retro' => $retro, 'author' => $author, 'link' => $link] = statusSyncLink(syncOn: false);

    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItems.update', [$retro->team->workspace, $item]), ['status' => 'completed'])
        ->assertOk();

    Queue::assertNotPushed(PushActionItemState::class);
    expect($link->fresh()->local_state_changed_at)->not->toBeNull();
});

it('does not push changes that came from the source', function () {
    Queue::fake();
    ['item' => $item, 'link' => $link] = statusSyncLink();

    DB::transaction(fn () => app(SetActionItemStatus::class)->handle(
        ActionItem::query()->whereKey($item->id)->lockForUpdate()->firstOrFail(),
        new ExternalSyncActor('jira', 'PROJ-1'),
        ActionItemStatus::Completed,
    ));

    Queue::assertNotPushed(PushActionItemState::class);
    expect($link->fresh()->local_state_changed_at)->toBeNull();
});

it('marks read-only connections instead of pushing', function () {
    Queue::fake();
    ['item' => $item, 'retro' => $retro, 'author' => $author, 'link' => $link] = statusSyncLink(access: IntegrationAccess::Read);

    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItems.update', [$retro->team->workspace, $item]), ['status' => 'completed'])
        ->assertOk();

    Queue::assertNotPushed(PushActionItemState::class);
    expect($link->fresh()->sync_error)->toBe('This Jira connection is read-only.');
});

it('pushes the current item state and records the result', function () {
    Event::fake([TeamActionItemSaved::class]);
    ['item' => $item, 'link' => $link] = statusSyncLink(['sync_error' => 'Old failure']);
    $item->forceFill(['completed_at' => now()])->save();
    fakeJiraTransitions($this->open, $this->done, [jiraTransition('31', '10002', 'Done', 'done')]);

    runStatusPush($link);

    $link->refresh();
    expect($link->last_pushed_state)->toBe(ExternalIssueState::Done)
        ->and($link->last_pushed_at?->toIso8601String())->toBe('2026-10-07T10:30:00+00:00')
        ->and($link->external_state)->toBe(ExternalIssueState::Done)
        ->and($link->external_status_name)->toBe('Done')
        ->and($link->last_synced_at)->not->toBeNull()
        ->and($link->sync_error)->toBeNull();
    Event::assertDispatched(TeamActionItemSaved::class);
});

it('skips the transition when the issue is already in that state', function () {
    ['item' => $item, 'link' => $link] = statusSyncLink();
    $item->forceFill(['completed_at' => now()])->save();
    fakeJiraTransitions($this->done, $this->done, []);

    runStatusPush($link);

    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), '/transitions'));
    expect($link->fresh()->external_state)->toBe(ExternalIssueState::Done);
});

it('records a push the source refuses', function () {
    ['item' => $item, 'link' => $link] = statusSyncLink();
    $item->forceFill(['completed_at' => now()])->save();
    fakeJiraTransitions($this->open, $this->done, [jiraTransition('11', '3', 'In Progress', 'indeterminate')]);

    runStatusPush($link);

    expect($link->fresh()->sync_error)->toBe('No transition to a done status is available for PROJ-1.');
});

it('marks a link missing when the issue is gone', function () {
    ['item' => $item, 'link' => $link] = statusSyncLink();
    $item->forceFill(['completed_at' => now()])->save();
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => Http::response(['issues' => [], 'isLast' => true])]);

    runStatusPush($link);

    expect($link->fresh()->missing_at)->not->toBeNull()
        ->and($link->fresh()->sync_error)->toBeNull();
});

it('waits when the source rate limits', function () {
    ['item' => $item, 'link' => $link] = statusSyncLink();
    $item->forceFill(['completed_at' => now()])->save();
    Http::fake([jiraApiUrl('rest/api/3/search/jql') => Http::response(['errorMessages' => ['Slow down']], 429, ['Retry-After' => '30'])]);

    runStatusPush($link)->assertReleased(delay: 30);

    expect($link->fresh()->sync_error)->toBeNull();
});

it('records the final failure', function () {
    ['link' => $link] = statusSyncLink();

    (new PushActionItemState($link->id))->failed(new ProviderUnavailable(IntegrationProvider::Jira, 'down'));

    expect($link->fresh()->sync_error)->toBe((new ProviderUnavailable(IntegrationProvider::Jira, 'down'))->userMessage());
});

it('calls nothing when sync is off or the connection needs a reconnect', function () {
    ['link' => $off] = statusSyncLink(syncOn: false);
    ['link' => $reconnect, 'integration' => $integration] = statusSyncLink();
    $integration->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save();

    runStatusPush($off);
    runStatusPush($reconnect);

    Http::assertNothingSent();
    expect($off->fresh()->sync_error)->toBeNull()
        ->and($reconnect->fresh()->sync_error)->toBe('Reconnect Jira in the team settings.');
});

it('lets managers retry a failed push from the board and the workspace', function () {
    Queue::fake();
    ['item' => $item, 'retro' => $retro, 'author' => $author, 'link' => $link] = statusSyncLink(['sync_error' => 'Boom']);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.external-links.sync.store', [$retro, $item, $link]))
        ->assertStatus(202)
        ->assertJsonPath('actionItem.id', $item->id);

    ['item' => $otherItem, 'retro' => $otherRetro, 'author' => $otherAuthor, 'link' => $second] = statusSyncLink(['sync_error' => 'Boom']);

    $this->actingAs($otherAuthor)
        ->postJson(route('workspaces.actionItemLinkSyncs.store', [$otherRetro->team->workspace, $otherItem, $second]))
        ->assertStatus(202);

    Queue::assertPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $link->id);
    Queue::assertPushed(PushActionItemState::class, fn (PushActionItemState $job) => $job->linkId === $second->id);
    expect($link->fresh()->sync_error)->toBeNull()
        ->and($second->fresh()->sync_error)->toBeNull();
});

it('refuses guests and non-managers before anything else', function () {
    Queue::fake();
    ['item' => $item, 'retro' => $retro, 'link' => $link, 'integration' => $integration] = statusSyncLink();
    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => false]])->save();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    [$member] = retroMember($retro);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->postJson(route('retros.action-items.external-links.sync.store', [$retro, $item, $link]))
        ->assertForbidden();

    $this->actingAs($member)
        ->postJson(route('retros.action-items.external-links.sync.store', [$retro, $item, $link]))
        ->assertForbidden();

    Queue::assertNothingPushed();
});

it('answers 409 when the push cannot happen and 404 for a link of another item', function () {
    Queue::fake();
    ['item' => $item, 'retro' => $retro, 'author' => $author, 'link' => $link, 'integration' => $integration] = statusSyncLink();
    $route = route('retros.action-items.external-links.sync.store', [$retro, $item, $link]);

    $integration->forceFill(['access' => IntegrationAccess::Read])->save();
    $this->actingAs($author)->postJson($route)->assertStatus(409);

    $integration->forceFill(['access' => IntegrationAccess::Write, 'settings' => [...$integration->settings, 'statusSync' => false]])->save();
    $this->actingAs($author)->postJson($route)->assertStatus(409)->assertJsonPath('message', 'Turn on status sync for Jira first.');

    $integration->forceFill(['settings' => [...$integration->settings, 'statusSync' => true]])->save();
    $link->forceFill(['external_site' => 'cloud-2'])->save();
    $this->actingAs($author)->postJson($route)->assertStatus(409)->assertJsonPath('message', 'This issue belongs to another Jira site.');

    $other = ActionItemExternalLink::factory()->create();
    $this->actingAs($author)
        ->postJson(route('retros.action-items.external-links.sync.store', [$retro, $item, $other]))
        ->assertNotFound();

    Queue::assertNothingPushed();
});
