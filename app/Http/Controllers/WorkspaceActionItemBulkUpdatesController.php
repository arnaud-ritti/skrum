<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemBulkChanges;
use App\Actions\Retros\PresentActionItem;
use App\Http\Requests\ActionItems\ActionItemBulkUpdateRequest;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;

class WorkspaceActionItemBulkUpdatesController extends Controller
{
    public function store(ActionItemBulkUpdateRequest $request, Workspace $workspace, ActionItemBulkChanges $bulkChanges, PresentActionItem $presentActionItem): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();
        $result = $bulkChanges->update($user, $workspace, $validated['ids'], $validated['changes']);

        return response()->json([
            'actionItems' => $presentActionItem->many($result['changed'], ActionItemActor::forUser($user)),
            'changedCount' => count($result['changed']),
            'refused' => $result['refused'],
        ]);
    }
}
