<?php

use App\Enums\RetroPhase;
use App\Events\Retros\CardGroupNamed;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Vote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    configureLlm();
});

function groupedRetro(RetroPhase $phase = RetroPhase::Grouping, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->withGuestAccess()->create(['ai_summary_enabled' => true, 'title' => 'Sprint 12', ...$attributes]);
    $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'To improve']);
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => 'Deploys are slow']);
    $child = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => 'CI is flaky', 'parent_card_id' => $lead->id]);
    $named = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => 'Named lead', 'group_name' => 'Already named', 'position' => 1]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'parent_card_id' => $named->id]);
    $single = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => 'Alone', 'position' => 2]);

    return [$retro, $lead, $child, $named, $single];
}

it('suggests names for unnamed groups without storing or broadcasting them', function () {
    fakeLlmReply([['index' => 1, 'name' => '  Release   pain ']]);
    [$retro, $lead, $child] = groupedRetro();
    [$user] = retroMember($retro);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $lead->id]);

    $this->actingAs($user)->postJson(route('retros.group-name-suggestions.store', $retro))
        ->assertOk()
        ->assertExactJson(['suggestions' => [['cardId' => $lead->id, 'name' => 'Release pain']]]);

    expect($lead->fresh()->group_name)->toBeNull()
        ->and(llmRequestBodies())
        ->toContain('Deploys are slow')->toContain('CI is flaky')->toContain('To improve')->toContain('Sprint 12')
        ->not->toContain('Named lead')->not->toContain('Alone')
        ->not->toContain($lead->id)->not->toContain($child->participant_id)
        ->not->toContain($child->participant->displayName())->not->toContain('votes');
    Event::assertNotDispatched(CardGroupNamed::class);
});

it('suggests names for the requested groups only and refuses cards that are not groups', function () {
    fakeLlmReply(['suggestions' => [['index' => 1, 'name' => 'Renamed']]]);
    [$retro, $lead, , $named, $single] = groupedRetro();
    [$user] = retroMember($retro);

    $this->actingAs($user)->postJson(route('retros.group-name-suggestions.store', $retro), ['cardIds' => [$named->id]])
        ->assertOk()
        ->assertJsonPath('suggestions.0.cardId', $named->id);

    $this->actingAs($user)->postJson(route('retros.group-name-suggestions.store', $retro), ['cardIds' => [$single->id]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['cardIds' => 'Only groups can be named.']);
});

it('drops invalid names and fails when none is usable', function (array|string $reply, int $status) {
    fakeLlmReply($reply);
    [$retro] = groupedRetro();
    [$user] = retroMember($retro);

    $response = $this->actingAs($user)->postJson(route('retros.group-name-suggestions.store', $retro))->assertStatus($status);

    if ($status === 502) {
        $response->assertJsonPath('message', 'Could not suggest names. Try again or name the groups yourself.');
    }
})->with([
    'unknown index kept out' => [[['index' => 7, 'name' => 'Ghost'], ['index' => 1, 'name' => 'Ok']], 200],
    'digit string index' => [[['index' => '1', 'name' => 'Ok']], 200],
    'nested index' => [[['index' => [1], 'name' => 'Ok']], 502],
    'too long' => [[['index' => 1, 'name' => str_repeat('a', 61)]], 502],
    'empty' => [[['index' => 1, 'name' => '   ']], 502],
    'not json' => ['no idea', 502],
]);

it('reports an unavailable provider', function () {
    fakeLlmFailure();
    [$retro] = groupedRetro();
    [$user] = retroMember($retro);

    $this->actingAs($user)->postJson(route('retros.group-name-suggestions.store', $retro))
        ->assertStatus(502)
        ->assertJsonPath('message', 'The text generator is unavailable. Try again later.');
});

it('hides suggestions without a provider or when the retro opted out', function () {
    [$retro] = groupedRetro(RetroPhase::Grouping, ['ai_summary_enabled' => false]);
    [$user] = retroMember($retro);

    $this->actingAs($user)->postJson(route('retros.group-name-suggestions.store', $retro))->assertNotFound();

    $retro->update(['ai_summary_enabled' => true]);
    config(['services.llm.key' => null]);

    $this->actingAs($user)->postJson(route('retros.group-name-suggestions.store', $retro))->assertNotFound();
});

it('follows the naming phases and lock and lets guests ask', function () {
    fakeLlmReply([['index' => 1, 'name' => 'Ok']]);
    [$retro] = groupedRetro(RetroPhase::Writing);
    [$user] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->postJson(route('retros.group-name-suggestions.store', $retro))->assertForbidden();

    $retro->update(['phase' => RetroPhase::Discussing]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->postJson(route('retros.group-name-suggestions.store', $retro))->assertOk();

    $retro->update(['is_locked' => true]);

    $this->actingAs($user)->postJson(route('retros.group-name-suggestions.store', $retro))->assertStatus(423);
});

it('rate limits suggestions per participant', function () {
    fakeLlmReply([['index' => 1, 'name' => 'Ok']]);
    [$retro] = groupedRetro();
    [$user] = retroMember($retro);

    foreach (range(1, 5) as $attempt) {
        $this->actingAs($user)->postJson(route('retros.group-name-suggestions.store', $retro))->assertOk();
    }

    $this->actingAs($user)->postJson(route('retros.group-name-suggestions.store', $retro))->assertTooManyRequests();
});
