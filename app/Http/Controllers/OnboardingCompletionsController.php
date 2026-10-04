<?php

namespace App\Http\Controllers;

use App\Enums\OnboardingStep;
use App\Http\Controllers\Concerns\LocksOnboarding;
use App\Models\Onboarding;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OnboardingCompletionsController extends Controller
{
    use LocksOnboarding;

    public const array Rituals = ['retro', 'poker', 'whiteboard', 'icebreaker'];

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'ritual' => ['nullable', 'string', Rule::in(self::Rituals)],
        ]);

        $ritual = $validated['ritual'] ?? null;

        $landing = DB::transaction(function () use ($request, $ritual): string {
            $onboarding = $this->lockedOnboarding($request->user());

            if ($onboarding->step === OnboardingStep::Team) {
                return $this->skipFromTeamStep($onboarding, $ritual);
            }

            $team = $onboarding->team;

            if ($onboarding->step !== OnboardingStep::Ritual || $team === null) {
                throw ValidationException::withMessages(['step' => __('This step is not available.')]);
            }

            $onboarding->update(['completed_at' => now()]);

            $query = $ritual === null ? '' : "?new={$ritual}";

            return route('teams.show', [$team->workspace, $team]).$query;
        });

        return redirect()->to($landing);
    }

    /**
     * "Skip for now" on step 2 (P25-03) ends the onboarding there, steps 3
     * and 4 included. The locked row was rewound first, so the team step
     * always has its workspace.
     */
    private function skipFromTeamStep(Onboarding $onboarding, ?string $ritual): string
    {
        if ($ritual !== null) {
            throw ValidationException::withMessages(['ritual' => __('Choose a first ritual on the last step.')]);
        }

        $onboarding->update(['completed_at' => now()]);

        return route('dashboard');
    }
}
