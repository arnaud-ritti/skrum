<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\CreateWorkspace;
use App\Enums\OnboardingStep;
use App\Enums\WorkspaceRole;
use App\Http\Controllers\Concerns\LocksOnboarding;
use App\Http\Requests\Onboarding\OnboardingWorkspaceRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

class OnboardingWorkspacesController extends Controller
{
    use LocksOnboarding;

    public function update(OnboardingWorkspaceRequest $request, CreateWorkspace $createWorkspace): RedirectResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($request, $user, $createWorkspace): void {
            $onboarding = $this->lockedOnboarding($user);
            $existing = $onboarding->workspace;

            if ($existing === null) {
                $workspace = $createWorkspace->handle($user, $request->string('name')->value());
                $workspace->update(['locale' => $request->validated('locale')]);
                $onboarding->workspace_id = $workspace->id;
            }

            if ($existing !== null) {
                abort_unless($user->roleIn($existing) === WorkspaceRole::Owner, 403);
                $existing->update($request->safe()->only(['name', 'locale']));
            }

            $onboarding->step = OnboardingStep::Team;
            $onboarding->save();
        });

        return to_route('onboarding.show');
    }
}
