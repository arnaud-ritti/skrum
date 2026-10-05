<?php

namespace App\Actions\Onboarding;

use App\Enums\OnboardingStep;
use App\Enums\WorkspaceRole;
use App\Models\Onboarding;
use App\Models\User;

class CloseOnboardingForJoiner
{
    /**
     * A person who joins a team before naming a workspace came to join, not
     * to found one. So did a default-workspace newcomer still at the
     * team step of a workspace they do not own.
     */
    public function handle(User $user): void
    {
        $onboarding = $user->onboarding()->whereNull('completed_at')->first();

        if ($onboarding === null) {
            return;
        }

        if (! $this->cameToJoin($onboarding, $user)) {
            return;
        }

        $onboarding->update(['completed_at' => now()]);
    }

    private function cameToJoin(Onboarding $onboarding, User $user): bool
    {
        $workspace = $onboarding->workspace;

        if ($workspace === null) {
            return true;
        }

        if ($onboarding->step !== OnboardingStep::Team) {
            return false;
        }

        if ($onboarding->team_id !== null) {
            return false;
        }

        return $user->roleIn($workspace) !== WorkspaceRole::Owner;
    }
}
