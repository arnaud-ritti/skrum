<?php

namespace App\Actions\Integrations;

use App\Enums\ExternalIssueState;
use App\Models\ActionItem;
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
    public const Off = 'off';

    public const Synced = 'synced';

    public const Pending = 'pending';

    public const Failed = 'failed';

    public const Missing = 'missing';

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

    /**
     * Spec 8 §7: `pending` until the source was read or while its state
     * differs from the item's (a push or a read is on its way).
     */
    public static function state(ActionItemExternalLink $link, ActionItem $item): string
    {
        $integration = self::integration($link, $item->team);

        if ($integration === null || ! $integration->isActive()) {
            return self::Off;
        }

        if ($link->missing_at !== null) {
            return self::Missing;
        }

        if ($link->sync_error !== null) {
            return self::Failed;
        }

        $itemState = $item->isCompleted() ? ExternalIssueState::Done : ExternalIssueState::Open;

        return $link->external_state === $itemState ? self::Synced : self::Pending;
    }
}
