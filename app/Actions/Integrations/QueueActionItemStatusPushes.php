<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Enums\ActionItemEventOrigin;
use App\Exceptions\Integrations\ReadOnlyConnection;
use App\Jobs\Integrations\PushActionItemState;
use App\Models\ActionItem;
use Throwable;

/**
 * Spec 8 §5.6: every status change made in skrum is remembered on the
 * item's links (the conflict rule compares it) and pushed where the
 * connection syncs. Changes that came from the source are never pushed
 * back, which is what stops loops. A failure here is reported, never
 * thrown into the request that changed the item.
 */
class QueueActionItemStatusPushes
{
    public function __construct(private BroadcastActionItemChange $broadcast) {}

    public function handle(ActionItem $item, ActionItemEventOrigin $origin): void
    {
        if ($origin !== ActionItemEventOrigin::Skrum) {
            return;
        }

        try {
            $this->queuePushes($item);
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private function queuePushes(ActionItem $item): void
    {
        $links = $item->externalLinks()->get();

        if ($links->isEmpty()) {
            return;
        }

        $item->externalLinks()->update(['local_state_changed_at' => now()]);
        $changed = false;

        foreach ($links as $link) {
            $integration = LinkStatusSync::integration($link, $item->team);

            if ($integration === null || ! $integration->isActive()) {
                continue;
            }

            if (! $integration->canWrite()) {
                $link->forceFill(['sync_error' => (new ReadOnlyConnection($integration->provider))->userMessage()])->save();
                $changed = true;

                continue;
            }

            $link->forceFill(['sync_error' => null])->save();
            dispatch(new PushActionItemState($link->id))->afterCommit();
            $changed = true;
        }

        if ($changed) {
            rescue(fn () => $this->broadcast->externalLinksChanged($item));
        }
    }
}
