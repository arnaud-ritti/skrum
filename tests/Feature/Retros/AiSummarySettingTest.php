<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Events\Retros\RetroSettingsChanged;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: Team, 1: User}
 */
function teamMemberCreatingRetros(): array
{
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($user);

    return [$team, $user];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function createRetroThroughTeamPage(Team $team, User $user, array $attributes = []): Retro
{
    $response = test()->actingAs($user)
        ->post(route('teams.retros.store', [$team->workspace, $team]), [
            'title' => 'Sprint 12',
            'template' => 'start_stop_continue',
            ...$attributes,
        ])
        ->assertRedirect();

    $retroId = basename((string) $response->headers->get('Location'));

    return Retro::query()->findOrFail($retroId);
}

it('turns the automatic summary on for new retros when a provider is configured', function () {
    configureLlm();
    [$team, $user] = teamMemberCreatingRetros();

    expect(createRetroThroughTeamPage($team, $user)->ai_summary_enabled)->toBeTrue()
        ->and(createRetroThroughTeamPage($team, $user, ['ai_summary_enabled' => false])->ai_summary_enabled)->toBeFalse();
});

it('never turns the automatic summary on without a provider', function () {
    [$team, $user] = teamMemberCreatingRetros();

    expect(createRetroThroughTeamPage($team, $user, ['ai_summary_enabled' => true])->ai_summary_enabled)->toBeFalse();
});

it('keeps existing retros opted out', function () {
    expect(Retro::factory()->create()->fresh()->ai_summary_enabled)->toBeFalse();
});

it('lets the facilitator toggle the automatic summary until completion', function () {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['ai_summary_enabled' => true]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['ai_summary_enabled' => false])->assertNoContent();

    expect($retro->fresh()->ai_summary_enabled)->toBeFalse();
    Event::assertDispatched(RetroSettingsChanged::class);

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['ai_summary_enabled' => true])->assertForbidden();
});

it('refuses the automatic summary toggle from others and without a provider', function () {
    configureLlm();
    $retro = Retro::factory()->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $this->actingAs($member)->patchJson(route('retros.settings.update', $retro), ['ai_summary_enabled' => true])->assertForbidden();

    config(['services.llm.key' => null]);

    $this->actingAs($facilitator)->patchJson(route('retros.settings.update', $retro), ['ai_summary_enabled' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['ai_summary_enabled' => 'Not available.']);
});

it('exposes the flag in the snapshot', function () {
    configureLlm();
    [$team] = teamMemberCreatingRetros();
    $retro = Retro::factory()->create(['team_id' => $team->id, 'ai_summary_enabled' => true]);
    [, $viewer] = retroMember($retro);

    expect(resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['retro']['aiSummaryEnabled'])->toBeTrue();
});
