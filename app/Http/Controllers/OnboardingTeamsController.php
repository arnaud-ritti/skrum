<?php

namespace App\Http\Controllers;

use App\Enums\OnboardingStep;
use App\Enums\TeamRole;
use App\Http\Controllers\Concerns\LocksOnboarding;
use App\Http\Requests\Onboarding\OnboardingTeamRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OnboardingTeamsController extends Controller
{
    use LocksOnboarding;

    public function update(OnboardingTeamRequest $request): RedirectResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($request, $user): void {
            $onboarding = $this->lockedOnboarding($user);
            $workspace = $onboarding->workspace;

            if ($workspace === null) {
                throw ValidationException::withMessages(['name' => __('Name your workspace first.')]);
            }

            $attributes = $request->safe()->only(['name', 'color', 'description']);
            $team = $onboarding->team;

            if ($team === null) {
                $team = $workspace->teams()->create($attributes);
                $team->members()->attach($user, ['role' => TeamRole::Owner->value]);
                $onboarding->team_id = $team->id;
            }

            if ($team->wasRecentlyCreated === false) {
                abort_unless($user->can('update', $team), 403);
                $team->update($attributes);
            }

            $onboarding->step = OnboardingStep::Invite;
            $onboarding->save();
        });

        return to_route('onboarding.show');
    }
}
