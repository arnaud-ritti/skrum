<?php

namespace App\Actions\ActionItems;

/**
 * The inbound status sync of an issue tracker (spec 8). It bypasses
 * permissions and board rules; no endpoint can construct it from a request.
 */
class ExternalSyncActor
{
    public function __construct(public string $source, public string $key) {}
}
