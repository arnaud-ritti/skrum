<?php

namespace App\Actions\Integrations;

use App\Models\ActionItemExternalLink;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\StatusSync;

/**
 * Which connection syncs a link (spec 8 §5.1): the team's connection of
 * the link's provider, enabled, with sync on and on the link's site —
 * whatever its connection state, which callers check themselves.
 */
class LinkStatusSync
{
    public static function integration(ActionItemExternalLink $link, Team $team): ?TeamIntegration
    {
        if (! $link->source->isEnabled()) {
            return null;
        }

        $integration = $team->relationLoaded('integrations')
            ? $team->integrations->first(fn (TeamIntegration $candidate): bool => $candidate->provider === $link->source)
            : $team->integration($link->source);

        if ($integration === null || ! StatusSync::isOn($integration) || $integration->site() !== $link->external_site) {
            return null;
        }

        return $integration;
    }
}
