<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Actions\Integrations\RequestActionItemPush;
use App\Actions\Retros\PresentActionItem;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkspaceActionItemLinkSyncsController extends Controller
{
    public function __construct(
        private RequestActionItemPush $requestActionItemPush,
        private PresentActionItem $presentActionItem,
    ) {}

    public function store(Request $request, Workspace $workspace, ActionItem $actionItem, ActionItemExternalLink $externalLink): JsonResponse
    {
        $user = $request->user();

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $actor = ActionItemActor::forUser($user);
        $item = $this->requestActionItemPush->handle($actionItem, $externalLink, $actor);

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)], 202);
    }
}
