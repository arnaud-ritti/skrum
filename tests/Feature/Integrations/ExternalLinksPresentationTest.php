<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Actions\Retros\PresentActionItem;
use App\Enums\RetroPhase;
use App\Events\Retros\ActionItemExternalLinksChanged;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationUserMapping;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

function linkedBoardItem(): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create();
    [$user, $member] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $member->id]);
    ActionItemExternalLink::factory()->linear()->create(['action_item_id' => $item->id, 'external_key' => 'ENG-7', 'external_url' => 'https://linear.app/acme/issue/ENG-7']);
    ActionItemExternalLink::factory()->create(['action_item_id' => $item->id, 'external_key' => 'PROJ-12', 'external_url' => 'https://acme.atlassian.net/browse/PROJ-12']);

    return [$retro, $item, $user, $member];
}

it('presents external links to members only', function () {
    [$retro, $item, , $member] = linkedBoardItem();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $present = resolve(PresentActionItem::class);
    $loaded = $item->fresh()->loadForPresentation();

    expect(collect($present->handle($loaded, ActionItemActor::forParticipant($member))['externalLinks'])
        ->map(fn (array $link): array => Arr::only($link, ['source', 'key', 'url', 'syncState']))
        ->all())->toBe([
            ['source' => 'jira', 'key' => 'PROJ-12', 'url' => 'https://acme.atlassian.net/browse/PROJ-12', 'syncState' => 'off'],
            ['source' => 'linear', 'key' => 'ENG-7', 'url' => 'https://linear.app/acme/issue/ENG-7', 'syncState' => 'off'],
        ])
        ->and($present->handle($loaded, ActionItemActor::forParticipant($guest))['externalLinks'])->toBe([])
        ->and($present->handle($loaded)['externalLinks'])->toBeNull();
});

it('hides external links from guests and broadcasts', function () {
    [$retro, , $user] = linkedBoardItem();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $guestSnapshot = $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk();

    $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('actionItems.0.externalLinks.0.key', 'PROJ-12');

    expect($guestSnapshot->json('actionItems.0.externalLinks'))->toBe([])
        ->and($guestSnapshot->getContent())->not->toContain('PROJ-12');
});

it('announces new links on the member channels of running retros only', function () {
    Event::fake();
    $team = Team::factory()->create();
    $source = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $team->id, 'created_at' => now()->subDays(14)]);
    $carrying = Retro::factory()->create(['team_id' => $team->id, 'created_at' => now()->subDay()]);
    $item = ActionItem::factory()->create(['retro_id' => $source->id]);
    ActionItemExternalLink::factory()->create(['action_item_id' => $item->id, 'external_key' => 'PROJ-3']);

    resolve(BroadcastActionItemChange::class)->externalLinksChanged($item->fresh());

    Event::assertDispatchedTimes(ActionItemExternalLinksChanged::class, 2);
    Event::assertDispatched(fn (ActionItemExternalLinksChanged $event) => $event->retroId === $carrying->id
        && $event->broadcastOn()->name === "private-retro-members.{$carrying->id}"
        && $event->broadcastAs() === 'action-item.external-links.changed'
        && $event->broadcastWith()['actionItemId'] === $item->id
        && Arr::only($event->broadcastWith()['externalLinks'][0], ['source', 'key', 'url']) === ['source' => 'jira', 'key' => 'PROJ-3', 'url' => $item->externalLinks()->first()->external_url]);
    Event::assertDispatched(fn (ActionItemExternalLinksChanged $event) => $event->retroId === $source->id);
});

it('stores the inactive flag of account mappings', function () {
    $mapping = IntegrationUserMapping::factory()->manual()->create(['account_inactive' => true]);

    expect($mapping->fresh()->account_inactive)->toBeTrue()
        ->and(IntegrationUserMapping::factory()->create()->fresh()->account_inactive)->toBeFalse();
});
