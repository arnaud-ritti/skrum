<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\AddActionItemComment;
use App\Actions\ActionItems\DeleteActionItemComment;
use App\Actions\ActionItems\PresentActionItemComment;
use App\Actions\ActionItems\UpdateActionItemComment;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class WorkspaceActionItemCommentsController extends Controller
{
    public function __construct(
        private PresentActionItemComment $presentActionItemComment,
        private AddActionItemComment $addActionItemComment,
        private UpdateActionItemComment $updateActionItemComment,
        private DeleteActionItemComment $deleteActionItemComment,
    ) {}

    public function index(Request $request, Workspace $workspace, ActionItem $actionItem): JsonResponse
    {
        $user = $request->user();

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $comments = $actionItem->comments()
            ->with(['authorParticipant.user', 'authorUser'])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return response()->json(['comments' => $this->presentActionItemComment->many($comments, ActionItemActor::forUser($user))]);
    }

    public function store(Request $request, Workspace $workspace, ActionItem $actionItem): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $validated = $request->validate(['content' => ['required', 'string', 'max:500']]);

        $comment = DB::transaction(fn (): ActionItemComment => $this->addActionItemComment->handle(
            WorkspaceActionItemGuard::lockWritable($actionItem->id),
            $actor,
            $validated['content'],
        ));

        return response()->json(['comment' => $this->presentActionItemComment->handle($comment, $actor)], 201);
    }

    public function update(Request $request, Workspace $workspace, ActionItemComment $actionItemComment): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItemComment->actionItem);

        $validated = $request->validate(['content' => ['required', 'string', 'max:500']]);

        $comment = DB::transaction(function () use ($actionItemComment, $actor, $validated): ActionItemComment {
            WorkspaceActionItemGuard::lockWritable($actionItemComment->action_item_id);

            return $this->updateActionItemComment->handle($actionItemComment->fresh() ?? abort(404), $actor, $validated['content']);
        });

        return response()->json(['comment' => $this->presentActionItemComment->handle($comment, $actor)]);
    }

    public function destroy(Request $request, Workspace $workspace, ActionItemComment $actionItemComment): Response
    {
        $user = $request->user();

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItemComment->actionItem);

        DB::transaction(function () use ($actionItemComment, $user): void {
            WorkspaceActionItemGuard::lockWritable($actionItemComment->action_item_id);

            $this->deleteActionItemComment->handle($actionItemComment->fresh() ?? abort(404), ActionItemActor::forUser($user));
        });

        return response()->noContent();
    }
}
