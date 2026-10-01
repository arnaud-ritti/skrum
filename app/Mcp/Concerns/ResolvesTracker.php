<?php

namespace App\Mcp\Concerns;

use App\Actions\Integrations\ResolvePokerTracker;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Validation\ValidationException;

trait ResolvesTracker
{
    /**
     * Spec 5 §2.4: the tool stays listed while another visible team has a
     * tracker, so a team without one gets its own explanation.
     */
    protected function trackerFor(Team $team, string $source): TeamIntegration
    {
        $resolvePokerTracker = resolve(ResolvePokerTracker::class);

        if (! $resolvePokerTracker->teamHasTracker($team)) {
            throw ValidationException::withMessages(['source' => __('This team has no connected tracker.')]);
        }

        return $resolvePokerTracker->handle($team, $source);
    }
}
