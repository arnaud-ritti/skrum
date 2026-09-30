<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\Integrations\ActionItemExportGuard;
use App\Actions\Integrations\ExportActionItem;
use App\Actions\Integrations\ExportActionItemRules;
use App\Actions\Retros\PresentActionItem;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Any phase: only a locked, still running board freezes its items (423,
 * as the workspace endpoints of spec 3).
 */
class RetroActionItemExportsController extends Controller
{
    public function __construct(
        private ActionItemExportGuard $guard,
        private ExportActionItem $exportActionItem,
        private PresentActionItem $presentActionItem,
    ) {}

    public function store(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));
        $user = $this->guard->authorize($actionItem, $actor);

        $validated = $request->validate(ExportActionItemRules::rules());
        $integration = $this->guard->integration($actionItem->team, $validated['source']);

        $result = $this->exportActionItem->handle($actionItem, $user, $integration, $validated);

        return response()->json([
            'actionItem' => $this->presentActionItem->handle($result['actionItem'], $actor),
            'warnings' => $result['warnings'],
        ], 201);
    }
}
