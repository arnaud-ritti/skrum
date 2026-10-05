<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: Retro, 1: User, 2: Participant}
 */
function retroLedInPhase(RetroPhase $phase, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroFacilitator($retro);

    return [$retro->fresh(), $user, $participant];
}

it('walks the eight phases forward and back', function () {
    [$retro, $user] = retroLedInPhase(RetroPhase::Icebreaker, ['icebreaker_enabled' => true]);
    $walk = ['writing', 'grouping', 'voting', 'discussing', 'actions', 'roti', 'completed'];

    expect(array_map(fn (RetroPhase $phase): string => $phase->value, $retro->phases()))->toBe(['icebreaker', ...$walk]);

    foreach ($walk as $phase) {
        $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => $phase])->assertOk();
    }

    foreach (['roti', 'actions', 'discussing', 'voting'] as $phase) {
        $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => $phase])->assertOk();
    }

    expect($retro->fresh()->phase)->toBe(RetroPhase::Voting);
});

it('skips no phase between discussing and completed', function () {
    [$retro, $user] = retroLedInPhase(RetroPhase::Discussing);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'roti'])->assertUnprocessable();

    expect($retro->fresh()->phase)->toBe(RetroPhase::Discussing);
});

it('reopens a completed retro on the roti phase', function () {
    [$retro, $user] = retroLedInPhase(RetroPhase::Completed);

    expect($retro->previousPhase())->toBe(RetroPhase::Roti);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'discussing'])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'roti'])->assertOk();

    expect($retro->fresh()->completed_at)->toBeNull();
});

it('creates, updates and deletes an action item in the actions phase', function () {
    [$retro, $user] = retroLedInPhase(RetroPhase::Actions);

    $id = $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Speed up CI'])
        ->assertCreated()
        ->json('actionItem.id');

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $id]), ['content' => 'Speed up the CI'])
        ->assertOk()
        ->assertJsonPath('actionItem.content', 'Speed up the CI');

    $this->actingAs($user)->deleteJson(route('retros.action-items.destroy', [$retro, $id]))->assertSuccessful();

    expect(ActionItem::query()->whereKey($id)->exists())->toBeFalse();
});

it('refuses action items on a locked board', function (RetroPhase $phase) {
    [$retro, $user] = retroLedInPhase($phase, ['is_locked' => true]);

    $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => 'Speed up CI'])->assertStatus(423);
})->with([
    'actions' => [RetroPhase::Actions],
    'roti' => [RetroPhase::Roti],
]);

it('still ticks an action item in the roti phase', function () {
    [$retro, $user, $participant] = retroLedInPhase(RetroPhase::Roti);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $item]), ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('actionItem.status', 'completed');
});

it('highlights a card in the actions phase and not in the roti phase', function () {
    [$retro, $user] = retroLedInPhase(RetroPhase::Actions);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $card->id])->assertOk();

    expect($retro->fresh()->highlighted_card_id)->toBe($card->id);

    $retro->update(['phase' => RetroPhase::Roti]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $card->id])->assertForbidden();
});

it('keeps the highlight between discussing and actions and clears it on the way to roti', function () {
    [$retro, $user] = retroLedInPhase(RetroPhase::Discussing);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $retro->update(['highlighted_card_id' => $card->id]);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'actions'])->assertOk();

    expect($retro->fresh()->highlighted_card_id)->toBe($card->id);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'discussing'])->assertOk();

    expect($retro->fresh()->highlighted_card_id)->toBe($card->id);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'actions'])->assertOk();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'roti'])->assertOk();

    expect($retro->fresh()->highlighted_card_id)->toBeNull();
});

it('shows vote totals in the actions and roti phases', function (RetroPhase $phase) {
    [$retro, , $viewer] = retroLedInPhase($phase, ['hide_vote_counts' => true]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $snapshot = resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer);

    expect(collect($snapshot['cards'])->firstWhere('id', $card->id)['votes'])->toBe(3)
        ->and($snapshot['retro']['phase'])->toBe($phase->value)
        ->and($snapshot['retro']['phases'])->toContain('actions', 'roti');
})->with([
    'actions' => [RetroPhase::Actions],
    'roti' => [RetroPhase::Roti],
]);

it('accepts a card comment, a card reaction and a group name in actions and refuses them in roti', function (RetroPhase $phase, int $status, int $commentStatus) {
    [$retro, $user] = retroLedInPhase($phase);
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id]);

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $lead]), ['content' => 'Agreed'])->assertStatus($commentStatus);
    $this->actingAs($user)->putJson(route('retros.cards.reactions.update', [$retro, $lead]), ['emoji' => '👍'])->assertStatus($status);
    $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $lead]), ['name' => 'Deploys'])->assertStatus($status);
})->with([
    'actions' => [RetroPhase::Actions, 200, 201],
    'roti' => [RetroPhase::Roti, 403, 403],
]);

it('refuses a survey answer in the actions phase', function () {
    [$retro, $user] = retroLedInPhase(RetroPhase::Actions);
    $survey = Survey::factory()->withOptions()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->putJson(route('retros.surveys.response.update', [$retro, $survey]), ['optionId' => $survey->options->first()->id])
        ->assertForbidden();
});

it('moves a retro left in discussing before the change to actions with its cards, votes and action items', function () {
    [$retro, $user, $participant] = retroLedInPhase(RetroPhase::Discussing);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id]);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'actions'])->assertOk();

    $snapshot = resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $participant);

    expect($snapshot['retro']['phase'])->toBe('actions')
        ->and(collect($snapshot['cards'])->firstWhere('id', $card->id)['votes'])->toBe(2)
        ->and(collect($snapshot['actionItems'])->pluck('id')->all())->toBe([$item->id]);
});

it('names the two phases', function () {
    expect(RetroPhase::Actions->label())->toBe('Actions')
        ->and(RetroPhase::Roti->label())->toBe('ROTI')
        ->and(RetroPhase::Actions->isOpen())->toBeTrue()
        ->and(RetroPhase::Roti->isOpen())->toBeTrue()
        ->and(array_values(array_filter(RetroPhase::cases(), fn (RetroPhase $phase): bool => $phase->takesActionItems())))
        ->toBe([RetroPhase::Discussing, RetroPhase::Actions, RetroPhase::Roti]);
});
