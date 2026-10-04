<?php

namespace App\Http\Controllers;

use App\Enums\OnboardingStep;
use App\Http\Controllers\Concerns\LocksOnboarding;
use App\Models\Team;
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

        $team = DB::transaction(function () use ($request): Team {
            $onboarding = $this->lockedOnboarding($request->user());
            $team = $onboarding->team;

            if ($onboarding->step !== OnboardingStep::Ritual || $team === null) {
                throw ValidationException::withMessages(['ritual' => __('This step is not available.')]);
            }

            $onboarding->update(['completed_at' => now()]);

            return $team;
        });

        $query = $ritual === null ? '' : "?new={$ritual}";

        return redirect()->to(route('teams.show', [$team->workspace, $team]).$query);
    }
}
