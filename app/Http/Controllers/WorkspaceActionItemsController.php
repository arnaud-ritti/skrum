<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Actions\ActionItems\ActionItemRules;
use App\Actions\ActionItems\ApplyActionItemChanges;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\ActionItems\DeleteActionItem;
use App\Actions\ActionItems\ResolveActionItemAssignee;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Actions\Retros\PresentActionItem;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WorkspaceActionItemsController extends Controller
{
    public function __construct(
        private PresentActionItem $presentActionItem,
        private ActionItemPermissions $permissions,
        private CreateActionItem $createActionItem,
        private ApplyActionItemChanges $applyActionItemChanges,
        private DeleteActionItem $deleteActionItem,
        private ResolveActionItemAssignee $resolveActionItemAssignee,
    ) {}

    public function store(Request $request, Workspace $workspace): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        $validated = $request->validate([
            'team_id' => ['required', 'uuid', Rule::exists('teams', 'id')->where('workspace_id', $workspace->id)],
            ...ActionItemRules::create(allowsGuests: false),
        ], ActionItemRules::messages());

        $team = Team::query()->whereKey($validated['team_id'])->firstOrFail();

        if ($user->cannot('view', $team)) {
            throw ValidationException::withMessages(['team_id' => __('The selected team is invalid.')]);
        }

        $this->permissions->authorizeCreateWithoutRetro($user, $team);

        $actionItem = DB::transaction(fn (): ActionItem => $this->createActionItem->handle($team, null, $actor, [
            ...ActionItemRules::attributes($validated),
            ...($this->resolveActionItemAssignee->handle($team, null, $validated) ?? []),
        ]));

        return response()->json(['actionItem' => $this->presentActionItem->handle($actionItem, $actor)], 201);
    }

    public function update(Request $request, Workspace $workspace, ActionItem $actionItem): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $validated = $request->validate(ActionItemRules::update(allowsGuests: false), ActionItemRules::messages());

        $updated = DB::transaction(fn (): ActionItem => $this->applyActionItemChanges->handle($this->lock($actionItem), $actor, $validated));

        return response()->json(['actionItem' => $this->presentActionItem->handle($updated, $actor)]);
    }

    public function destroy(Request $request, Workspace $workspace, ActionItem $actionItem): Response
    {
        $user = $request->user();

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        DB::transaction(function () use ($actionItem, $user): void {
            $this->deleteActionItem->handle($this->lock($actionItem), ActionItemActor::forUser($user));
        });

        return response()->noContent();
    }

    private function lock(ActionItem $actionItem): ActionItem
    {
        $locked = ActionItem::query()->whereKey($actionItem->id)->lockForUpdate()->firstOrFail();

        WorkspaceActionItemGuard::writable($locked);

        return $locked;
    }
}
