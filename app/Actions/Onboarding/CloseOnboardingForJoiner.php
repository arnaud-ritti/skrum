<?php

namespace App\Actions\Onboarding;

use App\Models\User;

class CloseOnboardingForJoiner
{
    /** A person who joins a team before naming a workspace came to join, not to found one. */
    public function handle(User $user): void
    {
        $user->onboarding()
            ->whereNull('completed_at')
            ->whereNull('workspace_id')
            ->first()
            ?->update(['completed_at' => now()]);
    }
}
