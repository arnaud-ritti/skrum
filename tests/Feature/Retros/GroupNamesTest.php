<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Events\Retros\CardGrouped;
use App\Events\Retros\CardGroupNamed;
use App\Events\Retros\CardsMoved;
use App\Events\Retros\CardUngrouped;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: Retro, 1: User, 2: Card, 3: Participant}
 */
function namedGroupRetro(RetroPhase $phase = RetroPhase::Grouping, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroMember($retro);
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id]);

    return [$retro, $user, $lead, $participant];
}

it('names and clears a group', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $route = route('retros.cards.group-name.update', [$retro, $lead]);

    $this->actingAs($user)->putJson($route, ['name' => '  Deploys  '])
        ->assertOk()
        ->assertExactJson(['cardId' => $lead->id, 'groupName' => 'Deploys']);

    expect($lead->fresh()->group_name)->toBe('Deploys');
    Event::assertDispatched(fn (CardGroupNamed $event) => $event->broadcastAs() === 'card.group-named'
        && $event->broadcastWith() === ['cardId' => $lead->id, 'groupName' => 'Deploys']);

    $this->actingAs($user)->deleteJson(route('retros.cards.group-name.destroy', [$retro, $lead]))
        ->assertOk()
        ->assertExactJson(['cardId' => $lead->id, 'groupName' => null]);

    expect($lead->fresh()->group_name)->toBeNull();
});

it('clears the name when it is blank', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);

    $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $lead]), ['name' => '   '])
        ->assertOk()
        ->assertJsonPath('groupName', null);

    expect($lead->fresh()->group_name)->toBeNull();
});

it('limits names to 60 characters', function () {
    [$retro, $user, $lead] = namedGroupRetro();

    $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $lead]), ['name' => str_repeat('a', 61)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('name');
});

it('lets guests name groups', function () {
    [$retro, , $lead] = namedGroupRetro(RetroPhase::Grouping, ['guest_access_enabled' => true]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCredentials()->withCookies(retroGuestCookie($guest))
        ->putJson(route('retros.cards.group-name.update', [$retro, $lead]), ['name' => 'Tooling'])
        ->assertOk();

    expect($lead->fresh()->group_name)->toBe('Tooling');
});

it('names groups from grouping to discussing only', function (RetroPhase $phase, int $status) {
    [$retro, $user, $lead] = namedGroupRetro($phase);

    $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $lead]), ['name' => 'Deploys'])->assertStatus($status);
})->with([
    'health check' => [RetroPhase::HealthCheck, 403],
    'writing' => [RetroPhase::Writing, 403],
    'grouping' => [RetroPhase::Grouping, 200],
    'voting' => [RetroPhase::Voting, 200],
    'discussing' => [RetroPhase::Discussing, 200],
    'completed' => [RetroPhase::Completed, 403],
]);

it('refuses to name groups on a locked board', function () {
    [$retro, $user, $lead] = namedGroupRetro(RetroPhase::Voting, ['is_locked' => true]);

    $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $lead]), ['name' => 'Deploys'])->assertStatus(423);
});

it('refuses to name a card that does not lead a group', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $single = Card::factory()->create(['retro_id' => $retro->id]);
    $child = $lead->children()->sole();

    foreach ([$single, $child] as $card) {
        $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $card]), ['name' => 'Deploys'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['card' => 'Only groups can be named.']);
    }

    expect(Card::whereNotNull('group_name')->count())->toBe(0);
});

it('returns 404 for cards of another retro', function () {
    [$retro, $user] = namedGroupRetro();
    [, , $foreignLead] = namedGroupRetro();

    $this->actingAs($user)->putJson(route('retros.cards.group-name.update', [$retro, $foreignLead]), ['name' => 'Deploys'])->assertNotFound();
});

it('hides the name of hidden cards and shows it on anonymous retros', function () {
    [$retro, , $lead, $viewer] = namedGroupRetro(RetroPhase::Writing, ['is_anonymous' => true]);
    $lead->update(['group_name' => 'Deploys']);

    $hidden = collect(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['cards'])->firstWhere('id', $lead->id);

    $retro->update(['phase' => RetroPhase::Grouping]);

    $revealed = collect(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['cards'])->firstWhere('id', $lead->id);

    expect($hidden['groupName'])->toBeNull()
        ->and($revealed['groupName'])->toBe('Deploys')
        ->and($revealed['author'])->toBeNull();
});

it('moves the name to the target when it has none', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);
    $target = Card::factory()->create(['retro_id' => $retro->id]);

    $response = $this->actingAs($user)->putJson(route('retros.cards.group.update', [$retro, $lead]), ['parent_card_id' => $target->id])
        ->assertOk();

    expect(collect($response->json('cards'))->firstWhere('id', $target->id)['groupName'])->toBe('Deploys')
        ->and($target->fresh()->group_name)->toBe('Deploys')
        ->and($lead->fresh()->group_name)->toBeNull();
    Event::assertDispatched(fn (CardGrouped $event) => collect($event->cards)->firstWhere('id', $target->id)['groupName'] === 'Deploys'
        && collect($event->cards)->firstWhere('id', $lead->id)['groupName'] === null);
});

it('keeps the target name when both groups are named', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $target = Card::factory()->create(['retro_id' => $retro->id, 'group_name' => 'Tooling']);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $target->column_id, 'parent_card_id' => $target->id]);
    $lead->update(['group_name' => 'Deploys']);

    $this->actingAs($user)->putJson(route('retros.cards.group.update', [$retro, $lead]), ['parent_card_id' => $target->id])->assertOk();

    expect($target->fresh()->group_name)->toBe('Tooling')
        ->and(Card::where('group_name', 'Deploys')->exists())->toBeFalse();
});

it('clears the former lead name when its last child is grouped elsewhere', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);
    $child = $lead->children()->sole();
    $target = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id]);

    $response = $this->actingAs($user)->putJson(route('retros.cards.group.update', [$retro, $child]), ['parent_card_id' => $target->id])
        ->assertOk();

    expect(collect($response->json('cards'))->firstWhere('id', $lead->id)['groupName'])->toBeNull()
        ->and($lead->fresh()->group_name)->toBeNull();
    Event::assertDispatched(fn (CardGrouped $event) => collect($event->cards)->firstWhere('id', $lead->id)['groupName'] === null);
});

it('clears the name when the last grouped card is ungrouped', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);
    $child = $lead->children()->sole();

    $response = $this->actingAs($user)->deleteJson(route('retros.cards.group.destroy', [$retro, $child]))->assertOk();

    expect(collect($response->json('cards'))->firstWhere('id', $lead->id)['groupName'])->toBeNull()
        ->and($lead->fresh()->group_name)->toBeNull();
    Event::assertDispatched(fn (CardUngrouped $event) => collect($event->cards)->firstWhere('id', $lead->id)['groupName'] === null);
});

it('keeps the name while grouped cards remain', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.group.destroy', [$retro, $lead->children()->first()]))->assertOk();

    expect($lead->fresh()->group_name)->toBe('Deploys');
});

it('clears the name when the last grouped card is moved out', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);
    $child = $lead->children()->sole();

    $response = $this->actingAs($user)->putJson(route('retros.cards.position.update', [$retro, $child]), ['column_id' => $lead->column_id, 'index' => 0])
        ->assertOk();

    expect(collect($response->json('cards'))->firstWhere('id', $lead->id)['groupName'])->toBeNull()
        ->and($lead->fresh()->group_name)->toBeNull();
    Event::assertDispatched(fn (CardsMoved $event) => collect($event->cards)->firstWhere('id', $lead->id)['groupName'] === null);
});

it('clears the name when the last grouped card is moved to another column', function () {
    [$retro, $user, $lead] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);
    $child = $lead->children()->sole();
    $otherColumn = Column::factory()->create(['retro_id' => $retro->id]);

    $response = $this->actingAs($user)->putJson(route('retros.cards.position.update', [$retro, $child]), ['column_id' => $otherColumn->id, 'index' => 0])
        ->assertOk();

    expect(collect($response->json('cards'))->firstWhere('id', $lead->id)['groupName'])->toBeNull()
        ->and($lead->fresh()->group_name)->toBeNull();
    Event::assertDispatched(fn (CardsMoved $event) => collect($event->cards)->firstWhere('id', $lead->id)['groupName'] === null);
});

it('clears the name when the last grouped card is deleted', function () {
    [$retro, $user, $lead, $participant] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys']);
    $lead->children()->sole()->update(['participant_id' => $participant->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.destroy', [$retro, $lead->children()->sole()]))->assertNoContent();

    expect($lead->fresh()->group_name)->toBeNull();
    Event::assertDispatched(fn (CardGroupNamed $event) => $event->cardId === $lead->id && $event->groupName === null);
});

it('leaves no name behind when the named lead is deleted', function () {
    [$retro, $user, $lead, $participant] = namedGroupRetro();
    $lead->update(['group_name' => 'Deploys', 'participant_id' => $participant->id]);
    $child = $lead->children()->sole();

    $this->actingAs($user)->deleteJson(route('retros.cards.destroy', [$retro, $lead]))->assertNoContent();

    expect($child->fresh()->only(['parent_card_id', 'group_name']))->toBe(['parent_card_id' => null, 'group_name' => null])
        ->and(Card::whereNotNull('group_name')->exists())->toBeFalse();
});
