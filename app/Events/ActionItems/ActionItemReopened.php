<?php

namespace App\Events\ActionItems;

use App\Enums\ActionItemEventOrigin;
use App\Models\ActionItem;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ActionItemReopened implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public ActionItem $actionItem, public ActionItemEventOrigin $origin) {}
}
