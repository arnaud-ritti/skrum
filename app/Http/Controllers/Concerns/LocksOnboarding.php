<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Onboarding;
use App\Models\User;

trait LocksOnboarding
{
    /**
     * The user's open onboarding row, locked: every step reads the row's
     * workspace and team under this lock, so that a double "Continue"
     * creates one of each.
     */
    private function lockedOnboarding(User $user): Onboarding
    {
        $onboarding = Onboarding::query()->where('user_id', $user->id)->lockForUpdate()->first();

        if ($onboarding === null || $onboarding->isCompleted()) {
            abort(404);
        }

        $onboarding->rewindToReachableStep();

        return $onboarding;
    }
}
