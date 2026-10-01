<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\Retros\PresentActionItem;
use App\Enums\ActionItemStatus;
use App\Enums\ExternalIssueState;
use App\Enums\RetroPhase;
use App\Events\Retros\ActionItemExternalLinksChanged;
use App\Models\ActionItem;
use App\Models\Participant;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:30:00'));
});

it('presents the sync state of each link to members', function (array $link, bool $syncOn, string $expected) {
    ['item' => $item, 'retro' => $retro] = statusSyncLink($link, syncOn: $syncOn);
    [, $member] = retroMember($retro);

    $presented = resolve(PresentActionItem::class)->handle($item->fresh()->loadForPresentation(), ActionItemActor::forParticipant($member));

    expect($presented['externalLinks'][0]['syncState'])->toBe($expected);
})->with([
    'sync off' => [['external_state' => ExternalIssueState::Open], false, 'off'],
    'synced' => [['external_state' => ExternalIssueState::Open], true, 'synced'],
    'never read' => [[], true, 'pending'],
    'states differ' => [['external_state' => ExternalIssueState::Done], true, 'pending'],
    'failed' => [['external_state' => ExternalIssueState::Open, 'sync_error' => 'Boom'], true, 'failed'],
    'missing' => [['external_state' => ExternalIssueState::Open, 'missing_at' => '2026-10-07 10:00:00'], true, 'missing'],
]);

it('presents every sync field of a link', function () {
    ['item' => $item, 'retro' => $retro, 'link' => $link] = statusSyncLink([
        'external_state' => ExternalIssueState::Open,
        'external_status_name' => 'In Review',
        'last_synced_at' => '2026-10-07 10:20:00',
    ]);
    [, $member] = retroMember($retro);

    expect(resolve(PresentActionItem::class)->handle($item->fresh()->loadForPresentation(), ActionItemActor::forParticipant($member))['externalLinks'])->toBe([[
        'id' => $link->id,
        'source' => 'jira',
        'key' => 'PROJ-1',
        'url' => 'https://acme.atlassian.net/browse/PROJ-1',
        'state' => 'open',
        'statusName' => 'In Review',
        'syncState' => 'synced',
        'syncError' => null,
        'lastSyncedAt' => '2026-10-07T10:20:00+00:00',
    ]]);
});

it('gives guests no links and broadcasts none', function () {
    ['item' => $item, 'retro' => $retro] = statusSyncLink(['sync_error' => 'Secret failure detail']);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $present = resolve(PresentActionItem::class);
    $loaded = $item->fresh()->loadForPresentation();

    expect($present->handle($loaded, ActionItemActor::forParticipant($guest))['externalLinks'])->toBe([])
        ->and($present->handle($loaded)['externalLinks'])->toBeNull();

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertDontSee('Secret failure detail');
});

it('says which tracker completed an item until it changes again', function () {
    ['item' => $item, 'retro' => $retro] = statusSyncLink();
    [, $member] = retroMember($retro);
    $setStatus = fn (ActionItemActor|ExternalSyncActor $actor, ActionItemStatus $status) => DB::transaction(
        fn () => resolve(SetActionItemStatus::class)->handle(ActionItem::query()->whereKey($item->id)->lockForUpdate()->firstOrFail(), $actor, $status),
    );

    $setStatus(new ExternalSyncActor('jira', 'PROJ-1'), ActionItemStatus::Completed);
    $loaded = $item->fresh()->loadForPresentation();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $present = resolve(PresentActionItem::class);

    expect($present->handle($loaded, ActionItemActor::forParticipant($member))['completedVia'])->toBe('jira')
        ->and($present->handle($loaded, ActionItemActor::forParticipant($guest))['completedVia'])->toBeNull()
        ->and($present->handle($loaded)['completedVia'])->toBeNull();

    $setStatus(new ExternalSyncActor('jira', 'PROJ-1'), ActionItemStatus::Open);
    expect($item->fresh()->completed_via_source)->toBeNull();
});

it('shows boards a pending sync as soon as a push is queued', function () {
    Event::fake([ActionItemExternalLinksChanged::class]);
    ['item' => $item, 'retro' => $retro, 'author' => $author] = statusSyncLink(['external_state' => ExternalIssueState::Open]);
    $retro->forceFill(['phase' => RetroPhase::Discussing])->save();

    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItems.update', [$retro->team->workspace, $item]), ['status' => 'completed'])
        ->assertOk();

    Event::assertDispatched(fn (ActionItemExternalLinksChanged $event) => $event->actionItemId === $item->id
        && $event->broadcastWith()['externalLinks'][0]['syncState'] === 'pending');
});
