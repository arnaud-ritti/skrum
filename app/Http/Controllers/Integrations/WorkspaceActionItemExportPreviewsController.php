<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Actions\Integrations\ActionItemExportGuard;
use App\Actions\Integrations\PreviewActionItemExport;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkspaceActionItemExportPreviewsController extends Controller
{
    public function __construct(private ActionItemExportGuard $guard, private PreviewActionItemExport $previewExport) {}

    public function show(Request $request, Workspace $workspace, ActionItem $actionItem): JsonResponse
    {
        $user = $request->user();

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $this->guard->authorize($actionItem, ActionItemActor::forUser($user));

        $validated = $request->validate(ActionItemExportGuard::sourceRules());
        $integration = $this->guard->integration($actionItem->team, $validated['source']);

        return response()->json($this->previewExport->handle($actionItem, $integration));
    }
}
