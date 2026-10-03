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
        $result = $bulkChanges->delete($request->user(), $workspace, $request->validated('ids'));

        return response()->json([
            'deleted' => $result['changed'],
            'refused' => $result['refused'],
        ]);
    }
}
