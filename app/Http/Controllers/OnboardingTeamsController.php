<?php

namespace App\Http\Controllers;

use App\Actions\Teams\CreateTeam;
use App\Enums\OnboardingStep;
use App\Enums\TeamRole;
use App\Http\Controllers\Concerns\LocksOnboarding;
use App\Http\Requests\Onboarding\OnboardingTeamRequest;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OnboardingTeamsController extends Controller
{
    use LocksOnboarding;

    /** Rule D-1: the onboarding row is the authorisation to create its one team in its workspace (the one step 1 created, or the instance's default workspace). */
    public function update(OnboardingTeamRequest $request, CreateTeam $createTeam): RedirectResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($request, $user, $createTeam): void {
            $onboarding = $this->lockedOnboarding($user);
            $workspace = $onboarding->workspace;

            if ($workspace === null) {
                throw ValidationException::withMessages(['name' => __('Name your workspace first.')]);
            }

            $attributes = $request->safe()->only(['name', 'color', 'description']);
            $slug = $request->validated('slug');

            if (is_string($slug) && $slug !== '') {
                $attributes['slug'] = $slug;
            }

            $team = $onboarding->team;

            if ($team === null) {
                $team = $createTeam->handle($workspace, $attributes);
                $team->members()->attach($user, ['role' => TeamRole::Owner->value]);
                $onboarding->team_id = $team->id;
            }

            if ($team->wasRecentlyCreated === false) {
                abort_unless($user->can('update', $team), 403);
                $this->updateTeam($team, $attributes, $workspace);
            }

            $onboarding->step = OnboardingStep::Invite;
            $onboarding->save();
        });

        return to_route('onboarding.show');
    }

    /** @param array<string, mixed> $attributes */
    private function updateTeam(Team $team, array $attributes, Workspace $workspace): void
    {
        try {
            DB::transaction(fn (): bool => $team->update($attributes));
        } catch (UniqueConstraintViolationException) {
            throw CreateTeam::slugTaken($workspace);
        }
    }
}
