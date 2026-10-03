<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemBulkChanges;
use App\Http\Requests\ActionItems\ActionItemBulkDeletionRequest;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;

class WorkspaceActionItemBulkDeletionsController extends Controller
{
    public function store(ActionItemBulkDeletionRequest $request, Workspace $workspace, ActionItemBulkChanges $bulkChanges): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();
        $ids = array_key_exists('ids', $validated)
            ? $validated['ids']
            : $bulkChanges->matching($user, $workspace, $validated['filters'] ?? [], (int) $validated['count']);
        $result = $bulkChanges->delete($user, $workspace, $ids);

        return response()->json([
            'deleted' => $result['changed'],
            'refused' => $result['refused'],
        ]);
    }
}
