<?php

use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('links a new action item to its topic', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user] = retroMember($retro);
    $topic = topicCard($retro);

    $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => 'Share the backlog on Mondays', 'card_id' => $topic->id])
        ->assertCreated()
        ->assertJsonPath('actionItem.cardId', $topic->id);

    expect(ActionItem::query()->sole()->card_id)->toBe($topic->id);
})->with([RetroPhase::Discussing, RetroPhase::Actions]);

it('creates an item without a topic as before', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => 'Book the room'])
        ->assertCreated()
        ->assertJsonPath('actionItem.cardId', null);
});

it('refuses a child card or a card of another retro as a topic', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $topic = topicCard($retro);
    $child = topicCard($retro, ['parent_card_id' => $topic->id]);
    $elsewhere = Card::factory()->create();

    foreach ([$child, $elsewhere] as $card) {
        $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => 'x', 'card_id' => $card->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['card_id' => 'Choose a topic of this retrospective.']);
    }

    expect(ActionItem::query()->count())->toBe(0);
});

it('moves an item to another topic, or takes it off its topic', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Actions)->create();
    [$user] = retroFacilitator($retro);
    $first = topicCard($retro);
    $second = topicCard($retro);
    $item = ActionItem::factory()->create(['team_id' => $retro->team_id, 'retro_id' => $retro->id, 'card_id' => $first->id]);

    $this->actingAs($user)->patchJson(route('retros.action-items.update', [$retro, $item]), ['card_id' => $second->id])
        ->assertOk()
        ->assertJsonPath('actionItem.cardId', $second->id);

    $this->actingAs($user)->patchJson(route('retros.action-items.update', [$retro, $item]), ['card_id' => null])
        ->assertOk()
        ->assertJsonPath('actionItem.cardId', null);
});

it('ignores a topic sent to the workspace endpoint', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$user] = retroFacilitator($retro);
    $topic = topicCard($retro);
    $item = ActionItem::factory()->create(['team_id' => $retro->team_id, 'retro_id' => $retro->id, 'created_by_user_id' => $user->id]);

    $this->actingAs($user)
        ->patchJson(route('workspaces.actionItems.update', [$retro->team->workspace, $item]), ['content' => 'Renamed', 'card_id' => $topic->id])
        ->assertOk();

    expect($item->fresh()->card_id)->toBeNull();
});
