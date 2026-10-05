<?php

namespace App\Actions\Onboarding;

use App\Enums\OnboardingStep;
use App\Models\Onboarding;
use App\Models\User;
use App\Models\Workspace;

class StartOnboarding
{
    /**
     * The user's one onboarding row, at the workspace step, or at the team
     * step in a workspace the user joined. A row that exists is
     * returned as it is, except a completed row of a user who belongs to no
     * workspace any more: it starts again from step 1.
     */
    public function handle(User $user, ?string $teamName = null, ?Workspace $workspace = null): Onboarding
    {
        $teamName = trim((string) $teamName);

        $onboarding = $user->onboarding()->createOrFirst(
            [],
            [
                'step' => $workspace === null ? OnboardingStep::Workspace : OnboardingStep::Team,
                'team_name' => $teamName === '' ? null : $teamName,
                'workspace_id' => $workspace?->id,
            ],
        );

        if (! $onboarding->isCompleted()) {
            return $onboarding;
        }

        if ($user->workspaces()->exists()) {
            return $onboarding;
        }

        $onboarding->update([
            'step' => OnboardingStep::Workspace,
            'workspace_id' => null,
            'team_id' => null,
            'completed_at' => null,
        ]);

        return $onboarding;
    }
}
