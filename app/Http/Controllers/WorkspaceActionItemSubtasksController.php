<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemSubtaskRules;
use App\Actions\ActionItems\AddActionItemSubtask;
use App\Actions\ActionItems\DeleteActionItemSubtask;
use App\Actions\ActionItems\UpdateActionItemSubtask;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Actions\Retros\PresentActionItem;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkspaceActionItemSubtasksController extends Controller
{
    public function __construct(
        private PresentActionItem $presentActionItem,
        private AddActionItemSubtask $addActionItemSubtask,
        private UpdateActionItemSubtask $updateActionItemSubtask,
        private DeleteActionItemSubtask $deleteActionItemSubtask,
    ) {}

    public function store(Request $request, Workspace $workspace, ActionItem $actionItem): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $validated = $request->validate(ActionItemSubtaskRules::create());

        $item = DB::transaction(fn (): ActionItem => $this->addActionItemSubtask->handle(
            WorkspaceActionItemGuard::lockWritable($actionItem->id),
            $actor,
            $validated['content'],
        ));

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)], 201);
    }

    public function update(Request $request, Workspace $workspace, ActionItemSubtask $actionItemSubtask): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItemSubtask->actionItem);

        $validated = $request->validate(ActionItemSubtaskRules::update());

        $item = DB::transaction(function () use ($actionItemSubtask, $actor, $validated): ActionItem {
            $locked = WorkspaceActionItemGuard::lockWritable($actionItemSubtask->action_item_id);

            return $this->updateActionItemSubtask->handle(
                $locked,
                $locked->subtasks()->whereKey($actionItemSubtask->id)->firstOrFail(),
                $actor,
                $validated,
            );
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)]);
    }

    public function destroy(Request $request, Workspace $workspace, ActionItemSubtask $actionItemSubtask): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItemSubtask->actionItem);

        $item = DB::transaction(function () use ($actionItemSubtask, $actor): ActionItem {
            $locked = WorkspaceActionItemGuard::lockWritable($actionItemSubtask->action_item_id);

            return $this->deleteActionItemSubtask->handle(
                $locked,
                $locked->subtasks()->whereKey($actionItemSubtask->id)->firstOrFail(),
                $actor,
            );
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)]);
    }
}
