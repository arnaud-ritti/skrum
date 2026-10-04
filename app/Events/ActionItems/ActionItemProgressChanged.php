<?php

namespace App\Events\ActionItems;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Enums\ActionItemEventOrigin;
use App\Models\ActionItem;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * An item was started or put back to do (spec 24 §6.1). A domain event: not broadcast, not
 * a webhook; its listener queues the tracker pushes.
 */
class ActionItemProgressChanged implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public ActionItem $actionItem,
        public ActionItemEventOrigin $origin,
        public ActionItemActor|ExternalSyncActor|null $actor = null,
    ) {}
}
