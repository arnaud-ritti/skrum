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
        $byIds = array_key_exists('ids', $validated);
        $ids = $byIds
            ? $validated['ids']
            : $bulkChanges->matching($user, $workspace, $validated['filters'] ?? [], (int) $validated['count']);
        $result = $bulkChanges->update($user, $workspace, $ids, $validated['changes']);

        return response()->json([
            'actionItems' => $byIds ? $presentActionItem->many($result['changed'], ActionItemActor::forUser($user)) : [],
            'changedCount' => count($result['changed']),
            'refused' => $result['refused'],
        ]);
    }
}
