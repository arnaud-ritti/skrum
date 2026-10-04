<?php

use App\Enums\OnboardingStep;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Onboarding;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

function onboardingSavedAtTeamStep(?Team $team = null): Onboarding
{
    $user = User::factory()->create();
    $workspace = $team?->workspace ?? Workspace::factory()->withMember($user, WorkspaceRole::Owner)->create();

    if ($team !== null) {
        $workspace->members()->attach($user, ['role' => WorkspaceRole::Owner->value]);
        $team->members()->attach($user, ['role' => TeamRole::Owner->value]);
    }

    return Onboarding::factory()->for($user)->atStep(OnboardingStep::Team)->create([
        'workspace_id' => $workspace->id,
        'team_id' => $team?->id,
    ]);
}

it('ends the onboarding at step two without creating a team, and opens the dashboard', function () {
    $onboarding = onboardingSavedAtTeamStep();

    $this->actingAs($onboarding->user)
        ->post(route('onboarding.completion.store'))
        ->assertRedirect(route('dashboard'));

    expect($onboarding->fresh()->isCompleted())->toBeTrue()
        ->and(Team::query()->count())->toBe(0);

    $this->actingAs($onboarding->user)->get(route('onboarding.show'))->assertRedirect(route('dashboard'));
    $this->actingAs($onboarding->user)->get(route('dashboard'))->assertRedirect(route('workspaces.show', $onboarding->workspace));
});

it('keeps the team saved before Back when step two is skipped', function () {
    $team = Team::factory()->create();
    $onboarding = onboardingSavedAtTeamStep($team);

    $this->actingAs($onboarding->user)->post(route('onboarding.completion.store'))->assertRedirect(route('dashboard'));

    expect($onboarding->fresh()->isCompleted())->toBeTrue()
        ->and($team->fresh())->not->toBeNull();
});

it('refuses a first ritual sent with the skip of step two', function () {
    $onboarding = onboardingSavedAtTeamStep();

    $this->actingAs($onboarding->user)
        ->post(route('onboarding.completion.store'), ['ritual' => 'retro'])
        ->assertSessionHasErrors('ritual');

    expect($onboarding->fresh()->isCompleted())->toBeFalse();
});

it('refuses to end the onboarding before the workspace step is saved', function () {
    $onboarding = Onboarding::factory()->create();

    $this->actingAs($onboarding->user)
        ->post(route('onboarding.completion.store'))
        ->assertSessionHasErrors('step');

    expect($onboarding->fresh()->isCompleted())->toBeFalse();
});
