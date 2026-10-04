<?php

namespace App\Http\Controllers;

use App\Enums\OnboardingStep;
use App\Http\Controllers\Concerns\LocksOnboarding;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OnboardingStepsController extends Controller
{
    use LocksOnboarding;

    /** The moves the stepper offers: "Back" on step 2, "Skip" on step 3. */
    private const array Moves = [
        [OnboardingStep::Team, OnboardingStep::Workspace],
        [OnboardingStep::Invite, OnboardingStep::Ritual],
    ];

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'step' => ['required', 'string', Rule::in([OnboardingStep::Workspace->value, OnboardingStep::Ritual->value])],
        ]);

        $target = OnboardingStep::from($validated['step']);

        DB::transaction(function () use ($request, $target): void {
            $onboarding = $this->lockedOnboarding($request->user());

            if (! in_array([$onboarding->step, $target], self::Moves, true)) {
                throw ValidationException::withMessages(['step' => __('This step is not available.')]);
            }

            $onboarding->update(['step' => $target]);
        });

        return to_route('onboarding.show');
    }
}
