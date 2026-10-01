<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\Integrations\RequestActionItemPush;
use App\Actions\Retros\PresentActionItem;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RetroActionItemLinkSyncsController extends Controller
{
    public function __construct(
        private RequestActionItemPush $requestActionItemPush,
        private PresentActionItem $presentActionItem,
    ) {}

    public function store(Request $request, Retro $retro, ActionItem $actionItem, ActionItemExternalLink $externalLink): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $item = $this->requestActionItemPush->handle($actionItem, $externalLink, $actor);

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)], 202);
    }
}
