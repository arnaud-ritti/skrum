<?php

namespace App\Http\Controllers\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemRules;
use App\Actions\ActionItems\ApplyActionItemChanges;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\ActionItems\DeleteActionItem;
use App\Actions\ActionItems\ResolveActionItemAssignee;
use App\Actions\Retros\PresentActionItem;
use App\Http\Controllers\Concerns\LocksDiscussingRetro;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class ActionItemsController extends Controller
{
    use LocksDiscussingRetro;

    public function __construct(
        private PresentActionItem $presentActionItem,
        private CreateActionItem $createActionItem,
        private ApplyActionItemChanges $applyActionItemChanges,
        private DeleteActionItem $deleteActionItem,
        private ResolveActionItemAssignee $resolveActionItemAssignee,
    ) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guardDiscussing($retro);

        $validated = $request->validate(ActionItemRules::create(allowsGuests: true), ActionItemRules::messages());

        $actionItem = DB::transaction(function () use ($retro, $actor, $validated): ActionItem {
            $locked = $this->lockDiscussingRetro($retro);

            return $this->createActionItem->handle($locked->team, $locked, $actor, [
                ...ActionItemRules::attributes($validated),
                ...($this->resolveActionItemAssignee->handle($locked->team, $locked, $validated) ?? []),
            ]);
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($actionItem, $actor)], 201);
    }

    public function update(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guardDiscussing($retro);

        $validated = $request->validate(ActionItemRules::update(allowsGuests: true), ActionItemRules::messages());

        $updated = DB::transaction(function () use ($retro, $actionItem, $actor, $validated): ActionItem {
            return $this->applyActionItemChanges->handle($this->lockActionItem($retro, $actionItem), $actor, $validated);
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($updated, $actor)]);
    }

    public function destroy(Request $request, Retro $retro, ActionItem $actionItem): Response
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guardDiscussing($retro);

        DB::transaction(function () use ($retro, $actionItem, $actor): void {
            $this->deleteActionItem->handle($this->lockActionItem($retro, $actionItem), $actor);
        });

        return response()->noContent();
    }
}
