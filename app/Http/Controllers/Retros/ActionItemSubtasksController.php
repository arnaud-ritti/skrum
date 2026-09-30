<?php

namespace App\Http\Controllers\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemSubtaskRules;
use App\Actions\ActionItems\AddActionItemSubtask;
use App\Actions\ActionItems\DeleteActionItemSubtask;
use App\Actions\ActionItems\UpdateActionItemSubtask;
use App\Actions\Retros\PresentActionItem;
use App\Http\Controllers\Concerns\LocksDiscussingRetro;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActionItemSubtasksController extends Controller
{
    use LocksDiscussingRetro;

    public function __construct(
        private PresentActionItem $presentActionItem,
        private AddActionItemSubtask $addActionItemSubtask,
        private UpdateActionItemSubtask $updateActionItemSubtask,
        private DeleteActionItemSubtask $deleteActionItemSubtask,
    ) {}

    public function store(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guardDiscussing($retro);

        $validated = $request->validate(ActionItemSubtaskRules::create());

        $item = DB::transaction(fn (): ActionItem => $this->addActionItemSubtask->handle(
            $this->lockActionItem($retro, $actionItem),
            $actor,
            $validated['content'],
        ));

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)], 201);
    }

    public function update(Request $request, Retro $retro, ActionItemSubtask $actionItemSubtask): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guardDiscussing($retro);

        $validated = $request->validate(ActionItemSubtaskRules::update());

        $item = DB::transaction(function () use ($retro, $actionItemSubtask, $actor, $validated): ActionItem {
            $locked = $this->lockActionItem($retro, $actionItemSubtask->actionItem);

            return $this->updateActionItemSubtask->handle(
                $locked,
                $locked->subtasks()->whereKey($actionItemSubtask->id)->firstOrFail(),
                $actor,
                $validated,
            );
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)]);
    }

    public function destroy(Request $request, Retro $retro, ActionItemSubtask $actionItemSubtask): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guardDiscussing($retro);

        $item = DB::transaction(function () use ($retro, $actionItemSubtask, $actor): ActionItem {
            $locked = $this->lockActionItem($retro, $actionItemSubtask->actionItem);

            return $this->deleteActionItemSubtask->handle(
                $locked,
                $locked->subtasks()->whereKey($actionItemSubtask->id)->firstOrFail(),
                $actor,
            );
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)]);
    }
}
