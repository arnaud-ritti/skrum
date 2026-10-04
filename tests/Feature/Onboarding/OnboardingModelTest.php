<?php

use App\Enums\OnboardingStep;
use App\Models\Onboarding;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

it('starts at the workspace step and is not completed', function () {
    $onboarding = Onboarding::factory()->create()->fresh();

    expect($onboarding->step)->toBe(OnboardingStep::Workspace)
        ->and($onboarding->isCompleted())->toBeFalse()
        ->and($onboarding->user->onboarding->is($onboarding))->toBeTrue();
});

it('numbers the steps from one to four', function () {
    expect(array_map(fn (OnboardingStep $step): int => $step->number(), OnboardingStep::cases()))->toBe([1, 2, 3, 4]);
});

it('gives a user one onboarding at most', function () {
    $user = User::factory()->create();
    Onboarding::factory()->for($user)->create();

    expect(fn () => DB::transaction(fn () => Onboarding::factory()->for($user)->create()))
        ->toThrow(UniqueConstraintViolationException::class);
});

it('forgets the workspace it created when the workspace is deleted', function () {
    $workspace = Workspace::factory()->create();
    $onboarding = Onboarding::factory()->create(['workspace_id' => $workspace->id]);

    $workspace->delete();

    expect($onboarding->fresh()->workspace_id)->toBeNull();
});
