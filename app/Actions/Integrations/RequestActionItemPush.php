<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Jobs\Integrations\PushActionItemState;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\StatusSync;

/**
 * Spec 8 §5.6: the managers' "Retry", which is also how a conflict is
 * resolved in skrum's favour.
 */
class RequestActionItemPush
{
    public function __construct(private ActionItemExportGuard $guard) {}

    public function handle(ActionItem $item, ActionItemExternalLink $link, ActionItemActor $actor): ActionItem
    {
        $this->guard->authorize($item, $actor);

        $provider = $link->source;

        abort_unless($provider->isEnabled(), 404);

        $integration = $item->team->integration($provider) ?? throw new NotConnected($provider);

        $integration->ensureWritable();

        $label = ['provider' => $provider->label()];

        if (! StatusSync::isOn($integration)) {
            abort(409, __('Turn on status sync for :provider first.', $label));
        }

        if ($integration->site() !== $link->external_site) {
            abort(409, __('This issue belongs to another :provider site.', $label));
        }

        $link->forceFill(['sync_error' => null])->save();

        PushActionItemState::dispatch($link->id);

        return $item->loadForPresentation();
    }
}
