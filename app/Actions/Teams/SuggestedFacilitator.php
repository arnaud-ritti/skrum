<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\User;

/**
 * The person the "New session" dialog proposes as a retro's facilitator (owner's decision 4 C):
 * a suggestion only, never an assignment.
 */
class SuggestedFacilitator
{
    /**
     * Null means "the person creating the retro".
     */
    public function for(Team $team): ?User
    {
        $list = $team->defaultFacilitators()->get();

        if ($list->isEmpty()) {
            return null;
        }

        if (! $team->facilitator_rotation_enabled) {
            return $list->first();
        }

        return $list->get($team->rotation_position % $list->count());
    }

    /**
     * The rotation moves on only when the retro follows its suggestion.
     * Must run inside the transaction that locked the team row.
     */
    public function follow(Team $locked, User $facilitator): void
    {
        if (! $locked->facilitator_rotation_enabled) {
            return;
        }

        if ($this->for($locked)?->id !== $facilitator->id) {
            return;
        }

        $locked->increment('rotation_position');
    }
}
