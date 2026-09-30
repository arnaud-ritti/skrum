<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\Integrations\ActionItemExportGuard;
use App\Actions\Integrations\PreviewActionItemExport;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RetroActionItemExportPreviewsController extends Controller
{
    public function __construct(private ActionItemExportGuard $guard, private PreviewActionItemExport $previewExport) {}

    public function show(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        $this->guard->authorize($actionItem, ActionItemActor::forParticipant(Participant::current($request)));

        $validated = $request->validate(ActionItemExportGuard::sourceRules());
        $integration = $this->guard->integration($actionItem->team, $validated['source']);

        return response()->json($this->previewExport->handle($actionItem, $integration));
    }
}
