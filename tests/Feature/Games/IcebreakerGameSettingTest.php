<?php

use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Events\Retros\RetroSettingsChanged;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;

function createRetroWithIcebreakerGame(Team $team, array $fields): TestResponse
{
    return test()->actingAs(teamMember($team))->post(route('teams.retros.store', ['workspace' => $team->workspace->slug, 'team' => $team->id]), [
        'title' => 'Sprint 42',
        'template' => 'start_stop_continue',
        'icebreaker_enabled' => true,
        ...$fields,
    ]);
}

it('stores the icebreaker game chosen at creation', function () {
    $team = Team::factory()->create();

    createRetroWithIcebreakerGame($team, ['icebreaker_game' => 'hangman'])->assertRedirect();

    expect(Retro::query()->sole()->icebreaker_game)->toBe(GameKind::Hangman);
});

it('starts with Draw & Guess by default', function () {
    $team = Team::factory()->create();

    createRetroWithIcebreakerGame($team, [])->assertRedirect();

    expect(Retro::query()->sole()->icebreaker_game)->toBe(GameKind::DrawAndGuess);
});

it('refuses the GIF game at creation without a GIF provider', function () {
    config(['services.gifs.key' => null]);
    $team = Team::factory()->create();

    createRetroWithIcebreakerGame($team, ['icebreaker_game' => 'gif'])
        ->assertSessionHasErrors(['icebreaker_game' => 'This game is not available.']);

    expect(Retro::query()->count())->toBe(0);
});

it('accepts the GIF game with a GIF provider', function () {
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'gif-key', 'rating' => 'pg']]);
    $team = Team::factory()->create();

    createRetroWithIcebreakerGame($team, ['icebreaker_game' => 'gif'])->assertRedirect();

    expect(Retro::query()->sole()->icebreaker_game)->toBe(GameKind::SprintGif);
});

it('lets the facilitator change the icebreaker game', function () {
    Event::fake([RetroSettingsChanged::class]);
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Writing)->create();
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['icebreaker_game' => 'decoded'])
        ->assertNoContent();

    expect($retro->fresh()->icebreaker_game)->toBe(GameKind::Decoded);
    Event::assertDispatched(RetroSettingsChanged::class);
});

it('refuses the icebreaker game setting to others, on completed retros and without a GIF provider', function () {
    config(['services.gifs.key' => null]);
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Writing)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $this->actingAs($member)
        ->patchJson(route('retros.settings.update', $retro), ['icebreaker_game' => 'hangman'])
        ->assertForbidden();
    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['icebreaker_game' => 'gif'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['icebreaker_game' => 'This game is not available.']);
    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['icebreaker_game' => 'chess'])
        ->assertUnprocessable();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['icebreaker_game' => 'hangman'])
        ->assertForbidden();

    expect($retro->fresh()->icebreaker_game)->toBe(GameKind::DrawAndGuess);
});

it('lists the icebreaker games on the team page', function () {
    config(['services.gifs.key' => null]);
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('icebreakerGames.0', ['value' => 'draw', 'label' => 'Draw & Guess', 'available' => true])
            ->where('icebreakerGames.1.available', false));
});
