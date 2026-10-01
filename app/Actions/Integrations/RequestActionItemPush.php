<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Jobs\Integrations\PushActionItemState;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Support\Integrations\StatusSync;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * Spec 8 §5.6: the managers' "Retry", which is also how a conflict is
 * resolved in skrum's favour.
 */
class RequestActionItemPush
{
    public function __construct(private ActionItemExportGuard $guard) {}

    public function handle(ActionItem $item, ActionItemExternalLink $link, ActionItemActor $actor): ActionItem
    {
        if ($actor->user === null) {
            throw new AuthorizationException(__('Guests cannot sync action items.'));
        }

        $this->guard->authorize($item, $actor);

        $integration = $this->guard->integration($item->team, $link->source->value);
        $label = ['provider' => $link->source->label()];

        abort_unless(StatusSync::isOn($integration), 409, __('Turn on status sync for :provider first.', $label));

        abort_if($integration->site() !== $link->external_site, 409, __('This issue belongs to another :provider site.', $label));

        $link->forceFill(['sync_error' => null])->save();

        dispatch(new PushActionItemState($link->id));

        return $item->loadForPresentation();
    }
}
