<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Events\Retros\CardGroupNamed;
use App\Models\Card;
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
    Event::assertDispatched(CardGroupNamed::class, fn (CardGroupNamed $event) => $event->broadcastAs() === 'card.group-named'
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

    $hidden = collect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['cards'])->firstWhere('id', $lead->id);

    $retro->update(['phase' => RetroPhase::Grouping]);

    $revealed = collect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['cards'])->firstWhere('id', $lead->id);

    expect($hidden['groupName'])->toBeNull()
        ->and($revealed['groupName'])->toBe('Deploys')
        ->and($revealed['author'])->toBeNull();
});
