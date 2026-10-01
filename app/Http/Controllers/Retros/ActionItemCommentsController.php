<?php

namespace App\Http\Controllers\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\AddActionItemComment;
use App\Actions\ActionItems\DeleteActionItemComment;
use App\Actions\ActionItems\PresentActionItemComment;
use App\Actions\ActionItems\UpdateActionItemComment;
use App\Http\Controllers\Concerns\LocksDiscussingRetro;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class ActionItemCommentsController extends Controller
{
    use LocksDiscussingRetro;

    public function __construct(
        private PresentActionItemComment $presentActionItemComment,
        private AddActionItemComment $addActionItemComment,
        private UpdateActionItemComment $updateActionItemComment,
        private DeleteActionItemComment $deleteActionItemComment,
    ) {}

    public function index(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $item = $retro->actionItems()->whereKey($actionItem->id)->firstOrFail();

        $comments = $item->comments()
            ->with(['authorParticipant.user', 'authorUser'])->oldest()
            ->orderBy('id')
            ->get();

        return response()->json(['comments' => $this->presentActionItemComment->many($comments, $actor)]);
    }

    public function store(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guardDiscussing($retro);

        $validated = $request->validate(['content' => ['required', 'string', 'max:500']]);

        $comment = DB::transaction(fn (): ActionItemComment => $this->addActionItemComment->handle($this->lockActionItem($retro, $actionItem), $actor, $validated['content']));

        return response()->json(['comment' => $this->presentActionItemComment->handle($comment, $actor)], 201);
    }

    public function update(Request $request, Retro $retro, ActionItemComment $actionItemComment): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guardDiscussing($retro);

        $validated = $request->validate(['content' => ['required', 'string', 'max:500']]);

        $comment = DB::transaction(fn (): ActionItemComment => $this->updateActionItemComment->handle($this->lockComment($retro, $actionItemComment), $actor, $validated['content']));

        return response()->json(['comment' => $this->presentActionItemComment->handle($comment, $actor)]);
    }

    public function destroy(Request $request, Retro $retro, ActionItemComment $actionItemComment): Response
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guardDiscussing($retro);

        DB::transaction(function () use ($retro, $actionItemComment, $actor): void {
            $this->deleteActionItemComment->handle($this->lockComment($retro, $actionItemComment), $actor);
        });

        return response()->noContent();
    }

    private function lockComment(Retro $retro, ActionItemComment $actionItemComment): ActionItemComment
    {
        $locked = $this->lockDiscussingRetro($retro);
        $comment = $locked->actionItemComments()->whereKey($actionItemComment->id)->firstOrFail();

        $comment->actionItem->setRelation('retro', $locked);

        return $comment;
    }
}
